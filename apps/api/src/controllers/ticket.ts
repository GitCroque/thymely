import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import axios from "axios";
import crypto from "crypto";
import sanitizeHtml from "sanitize-html";

import { auditLog } from "../lib/audit";

import { track } from "../lib/hog";
import { sendAssignedEmail } from "../lib/nodemailer/ticket/assigned";
import { sendComment } from "../lib/nodemailer/ticket/comment";
import { sendTicketCreate } from "../lib/nodemailer/ticket/create";
import { sendTicketStatus } from "../lib/nodemailer/ticket/status";
import { assignedNotification } from "../lib/notifications/issue/assigned";
import { commentNotification } from "../lib/notifications/issue/comment";
import { priorityNotification } from "../lib/notifications/issue/priority";
import {
  activeStatusNotification,
  statusUpdateNotification,
} from "../lib/notifications/issue/status";
import { sendWebhookNotification } from "../lib/notifications/webhook";
import { parsePagination } from "../lib/pagination";
import { requirePermission } from "../lib/roles";
import { decryptSecret } from "../lib/security/secrets";
import { assertSafeWebhookUrl } from "../lib/security/webhook-url";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

interface TicketWebhookSource {
  id: string;
  title: string;
  priority: string;
  email: string | null;
  name: string | null;
  type: string;
  createdBy: unknown;
  assignedTo?: unknown;
  client?: unknown;
}

const validateEmail = (email: string) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

function buildWebhookHeaders(secret: string | null | undefined, body: unknown) {
  if (!secret) {
    return { "Content-Type": "application/json" };
  }

  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${JSON.stringify(body)}`)
    .digest("hex");

  return {
    "Content-Type": "application/json",
    "X-Thymely-Timestamp": timestamp,
    "X-Thymely-Signature": `sha256=${signature}`,
  };
}

async function dispatchTicketCreatedWebhooks(ticket: TicketWebhookSource) {
  const webhooks = await prisma.webhooks.findMany({
    where: {
      type: "ticket_created",
      active: true,
    },
  });

  if (webhooks.length === 0) {
    return;
  }

  const message = {
    event: "ticket_created",
    id: ticket.id,
    title: ticket.title,
    priority: ticket.priority,
    email: ticket.email,
    name: ticket.name,
    type: ticket.type,
    createdBy: ticket.createdBy,
    assignedTo: ticket.assignedTo,
    client: ticket.client,
  };

  await Promise.allSettled(
    webhooks.map((webhook) => sendWebhookNotification(webhook, message))
  );
}

interface TicketCreateBody {
  name?: string;
  title: string;
  detail?: unknown;
  priority?: "low" | "medium" | "high" | "urgent";
  email?: string;
  type?: "support" | "bug" | "feature" | "maintenance";
  company?: { id: string; [key: string]: unknown } | string;
  engineer?: { id: string; name: string; [key: string]: unknown };
  createdBy?: { id: string; name: string; role: string; email: string };
}

const ticketCreateSchema = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const, maxLength: 200 },
    title: { type: "string" as const, maxLength: 500 },
    detail: {},
    priority: { type: "string" as const, enum: ["low", "medium", "high", "urgent"] },
    email: { type: "string" as const, format: "email", maxLength: 254 },
    type: { type: "string" as const, enum: ["support", "bug", "feature", "maintenance"] },
    company: {},
    engineer: {},
    createdBy: {},
  },
  required: ["title"],
  additionalProperties: false,
};

const paginationQuerySchema = {
  type: "object",
  properties: {
    page: { type: "string", pattern: "^[0-9]+$" },
    limit: { type: "string", pattern: "^[0-9]+$" },
  },
  additionalProperties: false,
} as const;

const uuidParamSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const successResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
  },
  required: ["success"],
  additionalProperties: true,
} as const;

const ticketResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    ticket: { type: "object", additionalProperties: true },
  },
  required: ["success", "ticket"],
  additionalProperties: true,
} as const;

const ticketListResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    tickets: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
    pagination: {
      type: "object",
      properties: {
        page: { type: "integer" },
        limit: { type: "integer" },
        total: { type: "integer" },
      },
      required: ["page", "limit", "total"],
      additionalProperties: false,
    },
  },
  required: ["success", "tickets", "pagination"],
  additionalProperties: true,
} as const;

const templateListResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    templates: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  },
  required: ["success", "templates"],
  additionalProperties: true,
} as const;

const templateResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    template: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  },
  required: ["success", "template"],
  additionalProperties: true,
} as const;

const sluglessTemplatesResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    tickets: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  },
  required: ["success", "tickets"],
  additionalProperties: true,
} as const;

async function createTicketCore(request: FastifyRequest<{ Body: TicketCreateBody }>, reply: FastifyReply, options: { authenticated: boolean }) {
  const { name, company, detail, title, priority, email, engineer, type, createdBy } = request.body;

  const user = options.authenticated ? await checkSession(request) : null;

      const ticket = await prisma.ticket.create({
        data: {
          name,
          title,
          detail: JSON.stringify(detail),
          priority: priority ? priority : "low",
          email,
          type: type ?? "support",
          createdBy: createdBy
            ? { id: createdBy.id, name: createdBy.name, role: createdBy.role, email: createdBy.email }
            : undefined,
      client: company !== undefined ? { connect: { id: typeof company === "string" ? company : company.id } } : undefined,
      fromImap: false,
      assignedTo: engineer && engineer.name !== "Unassigned" ? { connect: { id: engineer.id } } : undefined,
      isComplete: Boolean(false),
    },
  });

  if (email && validateEmail(email)) {
    await sendTicketCreate({
      id: ticket.id,
      email,
      createdAt: ticket.createdAt,
    });
  }

  if (engineer && engineer.name !== "Unassigned") {
    if (ticket.userId) {
      const assigned = await prisma.user.findUnique({ where: { id: ticket.userId } });
      if (assigned?.email) {
        await sendAssignedEmail(assigned.email);
      }
    }
    const assigner = user || await checkSession(request);
    await assignedNotification(engineer, ticket, assigner);
  }

  await dispatchTicketCreatedWebhooks(ticket);

  if (options.authenticated && user) {
    await auditLog(request, { action: "ticket.create", userId: user.id, target: "Ticket", targetId: ticket.id });
  }

  const hog = track();
  hog.capture({ event: "ticket_created", distinctId: ticket.id });

  reply.status(200).send({ message: "Ticket created correctly", success: true, id: ticket.id });
}

export function ticketRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: TicketCreateBody }>(
    "/api/v1/ticket/create",
    {
      preHandler: requirePermission(["issue::create"]),
      schema: { body: ticketCreateSchema },
    },
    (request, reply) => createTicketCore(request, reply, { authenticated: true })
  );

  fastify.post<{ Body: TicketCreateBody }>(
    "/api/v1/ticket/public/create",
    {
      config: { rateLimit: { max: 20, timeWindow: "15 minutes" } },
      schema: { body: ticketCreateSchema },
    },
    (request, reply) => {
      if (process.env.ALLOW_PUBLIC_TICKETS !== "true") {
        return reply.code(403).send({
          success: false,
          message: "Public ticket creation is disabled",
        });
      }
      return createTicketCore(request, reply, { authenticated: false });
    }
  );

  // Get a ticket by id - requires auth
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/ticket/:id",
    {
      preHandler: requirePermission(["issue::read"]),
      schema: {
        params: uuidParamSchema,
        response: { 200: ticketResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const ticket = await prisma.ticket.findUnique({
        where: {
          id: id,
        },
        include: {
          client: {
            select: { id: true, name: true, number: true, notes: true },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
        },
      });

      if (!ticket) {
        return reply.status(404).send({
          success: false,
          message: "Ticket not found",
        });
      }

      const [timeTracking, comments, files] = await Promise.all([
        prisma.timeTracking.findMany({
          where: {
            ticketId: id,
          },
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        }),
        prisma.comment.findMany({
          where: {
            ticketId: ticket.id,
            isDeleted: false,
          },
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        }),
        prisma.ticketFile.findMany({
          where: {
            ticketId: id,
          },
          select: {
            id: true,
            createdAt: true,
            filename: true,
            mime: true,
            size: true,
            ticketId: true,
            userId: true,
          },
        }),
      ]);

      const t = {
        ...ticket,
        comments: [...comments],
        TimeTracking: [...timeTracking],
        files: [...files],
      };

      reply.send({
        ticket: t,
        success: true,
      });
    }
  );

  // Get all tickets - requires auth
  fastify.get(
    "/api/v1/tickets/open",
    {
      preHandler: requirePermission(["issue::read"]),
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: ticketListResponseSchema },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { isComplete: false, hidden: false, isDeleted: false };

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          orderBy: [{ createdAt: "desc" }],
          skip,
          take,
          include: {
            client: {
              select: { id: true, name: true, number: true },
            },
            assignedTo: {
              select: { id: true, name: true },
            },
            team: {
              select: { id: true, name: true },
            },
          },
        }),
        prisma.ticket.count({ where }),
      ]);

      reply.send({
        tickets,
        pagination: { page, limit, total },
        success: true,
      });
    }
  );

  // Basic Search - requires auth
  fastify.post(
    "/api/v1/tickets/search",
    {
      preHandler: requirePermission(["issue::read"]),
      config: {
        rateLimit: { max: 30, timeWindow: "1 minute" },
      },
      schema: {
        body: {
          type: "object",
          properties: {
            query: { type: "string", maxLength: 500 },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<{ Body: { query: string } }>, reply: FastifyReply) => {
      const { query } = request.body;
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { title: { contains: query }, isDeleted: false };

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
        prisma.ticket.count({ where }),
      ]);

      reply.send({
        tickets,
        pagination: { page, limit, total },
        success: true,
      });
    }
  );

  // Get all tickets (admin)
  fastify.get(
    "/api/v1/tickets/all",
    {
      preHandler: requirePermission(["issue::read"]),
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: ticketListResponseSchema },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { hidden: false, isDeleted: false };

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          orderBy: [{ createdAt: "desc" }],
          skip,
          take,
          include: {
            client: {
              select: { id: true, name: true, number: true },
            },
            assignedTo: {
              select: { id: true, name: true },
            },
            team: {
              select: { id: true, name: true },
            },
          },
        }),
        prisma.ticket.count({ where }),
      ]);

      reply.send({
        tickets,
        pagination: { page, limit, total },
        success: true,
      });
    }
  );

  // Get all open tickets for a user
  fastify.get(
    "/api/v1/tickets/user/open",
    {
      preHandler: requirePermission(["issue::read"]),
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: ticketListResponseSchema },
      },
    },

    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { isComplete: false, userId: user!.id, hidden: false, isDeleted: false };

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          skip,
          take,
          include: {
            client: {
              select: { id: true, name: true, number: true },
            },
            assignedTo: {
              select: { id: true, name: true },
            },
            team: {
              select: { id: true, name: true },
            },
          },
        }),
        prisma.ticket.count({ where }),
      ]);

      reply.send({
        tickets,
        pagination: { page, limit, total },
        success: true,
      });
    }
  );

  // Get all closed tickets
  fastify.get(
    "/api/v1/tickets/completed",
    {
      preHandler: requirePermission(["issue::read"]),
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: ticketListResponseSchema },
      },
    },

    async (request: FastifyRequest, reply: FastifyReply) => {
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { isComplete: true, hidden: false, isDeleted: false };

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          skip,
          take,
          include: {
            client: {
              select: { id: true, name: true, number: true },
            },
            assignedTo: {
              select: { id: true, name: true },
            },
            team: {
              select: { id: true, name: true },
            },
          },
        }),
        prisma.ticket.count({ where }),
      ]);

      reply.send({
        tickets,
        pagination: { page, limit, total },
        success: true,
      });
    }
  );

  // Get all unassigned tickets
  fastify.get(
    "/api/v1/tickets/unassigned",
    {
      preHandler: requirePermission(["issue::read"]),
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: ticketListResponseSchema },
      },
    },

    async (request: FastifyRequest, reply: FastifyReply) => {
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { isComplete: false, assignedTo: null, hidden: false, isDeleted: false };

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
        prisma.ticket.count({ where }),
      ]);

      reply.send({
        success: true,
        tickets,
        pagination: { page, limit, total },
      });
    }
  );

  // Update a ticket
  fastify.put(
    "/api/v1/ticket/update",
    {
      preHandler: requirePermission(["issue::update"]),
      schema: {
        body: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            note: { type: "string", maxLength: 10000 },
            detail: {},
            title: { type: "string", maxLength: 500 },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            status: { type: "string", maxLength: 100 },
            client: {},
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<{ Body: { id: string; note?: string; detail?: string; title?: string; priority?: string; status?: "hold" | "needs_support" | "in_progress" | "in_review" | "done"; client?: unknown } }>, reply: FastifyReply) => {
      const { id, note, detail, title, priority, status, client: _client } =
        request.body;

      const user = await checkSession(request);

      const issue = await prisma.ticket.findUnique({
        where: { id: id },
      });

      await prisma.ticket.update({
        where: { id: id },
        data: {
          detail,
          note,
          title,
          priority,
          status,
        },
      });

      if (priority && issue!.priority !== priority) {
        await priorityNotification(issue, user, issue!.priority, priority);
      }

      if (status && issue!.status !== status) {
        await statusUpdateNotification(issue, user, status);
      }

      reply.send({
        success: true,
      });
    }
  );

  // Transfer a ticket to another user
  fastify.post(
    "/api/v1/ticket/transfer",
    {
      preHandler: requirePermission(["issue::transfer"]),
      schema: {
        body: {
          type: "object",
          properties: {
            user: { type: "string", format: "uuid" },
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<{ Body: { user?: string; id: string } }>, reply: FastifyReply) => {
      const { user, id } = request.body;

      const assigner = await checkSession(request);

      if (user) {
        const assigned = await prisma.user.update({
          where: { id: user },
          data: {
            tickets: {
              connect: {
                id: id,
              },
            },
          },
        });

        const { email } = assigned;

        const ticket = await prisma.ticket.findUnique({
          where: { id: id },
        });

        await sendAssignedEmail(email);
        await assignedNotification(assigned, ticket, assigner);
      } else {
        await prisma.ticket.update({
          where: { id: id },
          data: {
            userId: null,
          },
        });
      }

      reply.send({
        success: true,
      });
    }
  );

  // Transfer an Issue to another client
  fastify.post(
    "/api/v1/ticket/transfer/client",
    {
      preHandler: requirePermission(["issue::transfer"]),
      schema: {
        body: {
          type: "object",
          properties: {
            client: { type: "string", format: "uuid" },
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<{ Body: { client?: string; id: string } }>, reply: FastifyReply) => {
      const { client, id } = request.body;

      if (client) {
        await prisma.ticket.update({
          where: { id: id },
          data: {
            clientId: client,
          },
        });
      } else {
        await prisma.ticket.update({
          where: { id: id },
          data: {
            clientId: null,
          },
        });
      }

      reply.send({
        success: true,
      });
    }
  );

  // Link a ticket to another ticket

  // fastify.post(
  //   "/api/v1/ticket/link",

  //   async (request: FastifyRequest, reply: FastifyReply) => {
  //     const { ticket, id }: any = request.body;

  //     const prev: any = await prisma.ticket.findUnique({
  //       where: {
  //         id: id,
  //       },
  //     });

  //     const ids = [];

  //     if (prev.length !== undefined && prev.linked.length > 0) {
  //       ids.push(...prev.linked);
  //     }

  //     ids.push({
  //       id: ticket.id,
  //       title: ticket.title,
  //     });

  //     const data = await prisma.ticket.update({
  //       where: {
  //         id: id,
  //       },
  //       data: {
  //         linked: {
  //           ...ids,
  //         },
  //       },
  //     });
  //   }
  // );

  // Unlink a ticket from another ticket
  // fastify.post(
  //   "/api/v1/ticket/unlink",

  //   async (request: FastifyRequest, reply: FastifyReply) => {}
  // );

  // Comment on a ticket
  fastify.post(
    "/api/v1/ticket/comment",
    {
      preHandler: requirePermission(["issue::comment"]),
      schema: {
        body: {
          type: "object",
          properties: {
            text: { type: "string", maxLength: 10000 },
            id: { type: "string", format: "uuid" },
            public: { type: "boolean" },
          },
          required: ["text", "id"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<{ Body: { text: string; id: string; public?: boolean } }>, reply: FastifyReply) => {
      const { text, id, public: public_comment } = request.body;

      const user = await checkSession(request);

      const sanitizedText = sanitizeHtml(text, {
        allowedTags: ["p", "br", "a", "b", "i", "strong", "em", "ul", "ol", "li",
          "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code", "div", "span"],
        allowedAttributes: { a: ["href"] },
        allowedSchemes: ["http", "https", "mailto"],
        disallowedTagsMode: "discard",
      });

      await prisma.comment.create({
        data: {
          text: sanitizedText,
          public: public_comment,
          ticketId: id,
          userId: user!.id,
        },
      });

      const ticket = await prisma.ticket.findUnique({
        where: {
          id: id,
        },
      });

      const email = ticket?.email;
      const title = ticket?.title ?? "";
      if (public_comment && email) {
        sendComment(sanitizedText, title, ticket!.id, email);
      }

      await commentNotification(ticket, user);

      const hog = track();

      hog.capture({
        event: "ticket_comment",
        distinctId: ticket!.id,
      });

      reply.send({
        success: true,
      });
    }
  );

  fastify.post(
    "/api/v1/ticket/comment/delete",
    {
      preHandler: requirePermission(["issue::comment"]),
      schema: {
        body: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<{ Body: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.body;

      const token = await checkSession(request);

      const comment = await prisma.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        return reply.status(404).send({
          success: false,
          message: "Comment not found",
        });
      }

      if (comment.userId !== token!.id && !token!.isAdmin) {
        return reply.status(403).send({
          success: false,
          message: "Not authorized to delete this comment",
        });
      }

      await prisma.comment.update({
        where: { id: id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: token!.id,
        },
      });

      await auditLog(request, { action: "comment.delete", userId: token!.id, target: "Comment", targetId: id });

      reply.send({
        success: true,
      });
    }
  );

  // Update status of a ticket
  fastify.put(
    "/api/v1/ticket/status/update",
    {
      preHandler: requirePermission(["issue::update"]),
      schema: {
        body: {
          type: "object",
          properties: {
            status: { type: "boolean" },
            id: { type: "string", format: "uuid" },
          },
          required: ["status", "id"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<{ Body: { status: boolean; id: string } }>, reply: FastifyReply) => {
      const { status, id } = request.body;

      const user = await checkSession(request);

      const ticket = await prisma.ticket.update({
        where: { id: id },
        data: {
          isComplete: status,
        },
      });

      await activeStatusNotification(ticket, user, status ? "Completed" : "Outstanding");

      if (ticket.email && validateEmail(ticket.email)) {
        await sendTicketStatus({
          title: ticket.title,
          Number: ticket.Number,
          email: ticket.email,
          isComplete: ticket.isComplete,
        });
      }

      const webhooks = await prisma.webhooks.findMany({
        where: {
          type: "ticket_status_changed",
          active: true,
        },
      });

      const statusLabel = status ? "Completed" : "Outstanding";

      await Promise.allSettled(
        webhooks.map(async (webhook) => {
          try {
            await assertSafeWebhookUrl(webhook.url);
          } catch (_error) {
            request.log.error({ url: webhook.url }, "Unsafe webhook URL blocked");
            return;
          }

          const decryptedSecret = await decryptSecret(webhook.secret);

          if (webhook.url.includes("discord.com")) {
            const message = {
              content: `Ticket ${ticket.id} created by ${ticket.email}, has had it's status changed to ${statusLabel}`,
              avatar_url:
                "https://avatars.githubusercontent.com/u/76014454?s=200&v=4",
              username: "Thymely",
            };

            await axios.post(webhook.url, message, {
              timeout: 5000,
              maxRedirects: 0,
              headers: buildWebhookHeaders(decryptedSecret, message),
            });
            return;
          }

          const payload = {
            data: `Ticket ${ticket.id} created by ${ticket.email}, has had it's status changed to ${statusLabel}`,
          };
          await axios.post(webhook.url, payload, {
            timeout: 5000,
            maxRedirects: 0,
            headers: buildWebhookHeaders(decryptedSecret, payload),
          });
        })
      );

      reply.send({
        success: true,
      });
    }
  );

  // Hide a ticket
  fastify.put(
    "/api/v1/ticket/status/hide",
    {
      preHandler: requirePermission(["issue::update"]),
      schema: {
        body: {
          type: "object",
          properties: {
            hidden: { type: "boolean" },
            id: { type: "string", format: "uuid" },
          },
          required: ["hidden", "id"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<{ Body: { hidden: boolean; id: string } }>, reply: FastifyReply) => {
      const { hidden, id } = request.body;

      await prisma.ticket.update({
        where: { id: id },
        data: {
          hidden: hidden,
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Lock a ticket
  fastify.put(
    "/api/v1/ticket/status/lock",
    {
      preHandler: requirePermission(["issue::update"]),
      schema: {
        body: {
          type: "object",
          properties: {
            locked: { type: "boolean" },
            id: { type: "string", format: "uuid" },
          },
          required: ["locked", "id"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<{ Body: { locked: boolean; id: string } }>, reply: FastifyReply) => {
      const { locked, id } = request.body;

      await prisma.ticket.update({
        where: { id: id },
        data: {
          locked: locked,
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Delete a ticket
  fastify.post(
    "/api/v1/ticket/delete",
    {
      preHandler: requirePermission(["issue::delete"]),
      schema: {
        body: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    async (request: FastifyRequest<{ Body: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.body;

      const user = await checkSession(request);

      await prisma.ticket.update({
        where: { id: id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: user!.id,
        },
      });

      await auditLog(request, { action: "ticket.delete", userId: user!.id, target: "Ticket", targetId: id });

      reply.send({
        success: true,
      });
    }
  );

  // Get all tickets that created via imap
  fastify.get(
    "/api/v1/tickets/imap/all",
    {
      schema: {
        response: { 200: sluglessTemplatesResponseSchema },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.send({
        success: true,
        tickets: [],
      });
    }
  );

  // GET all ticket templates
  fastify.get(
    "/api/v1/ticket/templates",
    {
      preHandler: requirePermission(["email_template::manage"]),
      schema: {
        response: { 200: templateListResponseSchema },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const templates = await prisma.emailTemplate.findMany({
        select: {
          createdAt: true,
          updatedAt: true,
          type: true,
          id: true,
        },
      });

      reply.send({
        success: true,
        templates: templates,
      });
    }
  );

  // GET ticket template by ID
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/ticket/template/:id",
    {
      preHandler: requirePermission(["email_template::manage"]),
      schema: {
        params: uuidParamSchema,
        response: { 200: templateResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const template = await prisma.emailTemplate.findMany({
        where: {
          id: id,
        },
      });

      reply.send({
        success: true,
        template: template,
      });
    }
  );

  // PUT ticket template by ID
  fastify.put<{ Params: { id: string }; Body: { html: string } }>(
    "/api/v1/ticket/template/:id",
    {
      preHandler: requirePermission(["email_template::manage"]),
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            html: { type: "string", maxLength: 50000 },
          },
          required: ["html"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const { html } = request.body;

      const sanitizedHtml = sanitizeHtml(html, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "style", "table", "thead", "tbody", "tr", "td", "th", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6"]),
        allowedAttributes: {
          "*": ["style", "class"],
          a: ["href"],
          img: ["src", "alt", "width", "height"],
          table: ["align", "border", "cellpadding", "cellspacing", "bgcolor", "width"],
          td: ["align", "bgcolor", "width", "height"],
          th: ["align", "bgcolor", "width", "height"],
          tr: ["align", "bgcolor"],
          div: ["align"],
          span: [],
        },
        allowedSchemes: ["http", "https", "mailto", "data"],
      });

      await prisma.emailTemplate.update({
        where: {
          id: id,
        },
        data: {
          html: sanitizedHtml,
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Get all open tickets for an external user
  fastify.get(
    "/api/v1/tickets/user/open/external",
    {
      preHandler: requirePermission(["issue::read"]),
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: ticketListResponseSchema },
      },
    },

    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { isComplete: false, email: user!.email, hidden: false, isDeleted: false };

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          skip,
          take,
          include: {
            client: {
              select: { id: true, name: true, number: true },
            },
            assignedTo: {
              select: { id: true, name: true },
            },
            team: {
              select: { id: true, name: true },
            },
          },
        }),
        prisma.ticket.count({ where }),
      ]);

      reply.send({
        tickets,
        pagination: { page, limit, total },
        success: true,
      });
    }
  );

  // Get all closed tickets for an external user
  fastify.get(
    "/api/v1/tickets/user/closed/external",
    {
      preHandler: requirePermission(["issue::read"]),
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: ticketListResponseSchema },
      },
    },

    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { isComplete: true, email: user!.email, hidden: false, isDeleted: false };

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          skip,
          take,
          include: {
            client: {
              select: { id: true, name: true, number: true },
            },
            assignedTo: {
              select: { id: true, name: true },
            },
            team: {
              select: { id: true, name: true },
            },
          },
        }),
        prisma.ticket.count({ where }),
      ]);

      reply.send({
        tickets,
        pagination: { page, limit, total },
        success: true,
      });
    }
  );

  // Get all tickets for an external user
  fastify.get(
    "/api/v1/tickets/user/external",
    {
      preHandler: requirePermission(["issue::read"]),
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: ticketListResponseSchema },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { email: user!.email, hidden: false, isDeleted: false };

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          skip,
          take,
          include: {
            client: {
              select: { id: true, name: true, number: true },
            },
            assignedTo: {
              select: { id: true, name: true },
            },
            team: {
              select: { id: true, name: true },
            },
          },
        }),
        prisma.ticket.count({ where }),
      ]);

      reply.send({
        tickets,
        pagination: { page, limit, total },
        success: true,
      });
    }
  );

  // Subscribe to a ticket
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/ticket/subscribe/:id",
    {
      preHandler: requirePermission(["issue::read"]),
      schema: {
        params: uuidParamSchema,
        response: { 200: successResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const user = await checkSession(request);

      if (id) {
        const ticket = await prisma.ticket.findUnique({
          where: { id: id },
        });

        const following = ticket?.following as string[];

        if (following.includes(user!.id)) {
          reply.send({
            success: false,
            message: "You are already following this issue",
          });
        }

        if (ticket) {
          await prisma.ticket.update({
            where: { id: id },
            data: {
              following: [...following, user!.id],
            },
          });
        } else {
          reply.status(400).send({
            success: false,
            message: "No ticket ID provided",
          });
        }

        reply.send({
          success: true,
        });
      }
    }
  );

  // Unsubscribe from a ticket
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/ticket/unsubscribe/:id",
    {
      preHandler: requirePermission(["issue::read"]),
      schema: {
        params: uuidParamSchema,
        response: { 200: successResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = await checkSession(request);

      if (id) {
        const ticket = await prisma.ticket.findUnique({
          where: { id: id },
        });

        const following = ticket?.following as string[];

        if (!following.includes(user!.id)) {
          return reply.send({
            success: false,
            message: "You are not following this issue",
          });
        }

        if (ticket) {
          await prisma.ticket.update({
            where: { id: id },
            data: {
              following: following.filter((userId) => userId !== user!.id),
            },
          });
        } else {
          return reply.status(400).send({
            success: false,
            message: "No ticket ID provided",
          });
        }

        reply.send({
          success: true,
        });
      }
    }
  );
}
