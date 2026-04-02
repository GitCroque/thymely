import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { OAuth2Client } from "google-auth-library";
import { track } from "../lib/hog";
import logger from "../lib/logger";
import { requirePermission } from "../lib/roles";
import { decryptSecret, encryptSecret } from "../lib/security/secrets";
import { prisma } from "../prisma";

const successResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    message: { type: "string" },
  },
  required: ["success"],
};

async function tracking(event: string, properties: Record<string, unknown>) {
  const client = track();

  client.capture({
    event: event,
    properties: properties,
    distinctId: "uuid",
  });

  client.shutdownAsync();
}

export function emailQueueRoutes(fastify: FastifyInstance) {
  // Create a new email queue
  fastify.post<{
    Body: {
      name: string;
      username: string;
      password: string;
      hostname: string;
      tls: boolean;
      serviceType: string;
      clientId: string | undefined;
      clientSecret: string | undefined;
      redirectUri: string | undefined;
    };
  }>(
    "/api/v1/email-queue/create",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 200 },
            username: { type: "string", maxLength: 254 },
            password: { type: "string", maxLength: 500 },
            hostname: { type: "string", maxLength: 255 },
            tls: { type: "boolean" },
            serviceType: { type: "string", enum: ["gmail", "other"] },
            clientId: { type: "string", nullable: true, maxLength: 500 },
            clientSecret: { type: "string", nullable: true, maxLength: 2000 },
            redirectUri: { type: "string", nullable: true, maxLength: 2000 },
          },
          required: ["name", "username", "password", "hostname", "tls", "serviceType"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              authorizeUrl: { type: "string" },
            },
            required: ["success", "message"],
          },
        },
      },
    },
    async (request, reply) => {
      const {
        name,
        username,
        password,
        hostname,
        tls,
        serviceType,
        clientId,
        clientSecret,
        redirectUri,
      } = request.body;
      const encryptedPassword = await encryptSecret(password);
      const encryptedClientSecret = await encryptSecret(clientSecret);

      const mailbox = await prisma.emailQueue.create({
        data: {
          name: name,
          username,
          password: encryptedPassword,
          hostname,
          tls,
          serviceType,
          clientId,
          clientSecret: encryptedClientSecret,
          redirectUri,
        },
      });

      // generate redirect uri
      switch (serviceType) {
        case "gmail":
          const google = new OAuth2Client(clientId, clientSecret, redirectUri);

          const authorizeUrl = google.generateAuthUrl({
            access_type: "offline",
            scope: "https://mail.google.com",
            prompt: "consent",
            state: mailbox.id,
          });

          tracking("gmail_provider_created", {
            provider: "gmail",
          });

          reply.send({
            success: true,
            message: "Gmail imap provider created!",
            authorizeUrl: authorizeUrl,
          });
          break;
        case "other":
          tracking("imap_provider_created", {
            provider: "other",
          });

          reply.send({
            success: true,
            message: "Other service type created!",
          });
          break;
        default:
          reply.send({
            success: false,
            message: "Unsupported service type",
          });
      }
    }
  );

  // Google oauth callback
  fastify.get<{
    Querystring: {
      code: string;
      mailboxId: string;
    };
  }>(
    "/api/v1/email-queue/oauth/gmail",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        querystring: {
          type: "object",
          properties: {
            code: { type: "string", minLength: 1 },
            mailboxId: { type: "string", format: "uuid" },
          },
          required: ["code", "mailboxId"],
        },
        response: {
          200: successResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { code, mailboxId } = request.query;

      const mailbox = await prisma.emailQueue.findFirst({
        where: {
          id: mailboxId,
        },
      });
      const decryptedClientSecret = await decryptSecret(mailbox?.clientSecret);

      const google = new OAuth2Client(
        mailbox?.clientId ?? undefined,
        decryptedClientSecret ?? undefined,
        mailbox?.redirectUri ?? undefined
      );

      logger.debug("Google OAuth client initialized");

      const r = await google.getToken(code);

      await prisma.emailQueue.update({
        where: { id: mailbox?.id },
        data: {
          refreshToken: await encryptSecret(r.tokens.refresh_token),
          accessToken: await encryptSecret(r.tokens.access_token),
          expiresIn: r.tokens.expiry_date,
          serviceType: "gmail",
        },
      });

      reply.send({
        success: true,
        message: "Mailbox updated!",
      });
    }
  );

  // Get all email queue's
  fastify.get(
    "/api/v1/email-queues/all",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              queues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    serviceType: { type: "string" },
                    active: { type: "boolean" },
                    teams: {},
                    username: { type: "string", nullable: true },
                    hostname: { type: "string", nullable: true },
                    tls: { type: "boolean", nullable: true },
                    clientId: { type: "string", nullable: true },
                    redirectUri: { type: "string", nullable: true },
                  },
                  required: ["id", "name", "serviceType", "active"],
                },
              },
            },
            required: ["success", "queues"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const queues = await prisma.emailQueue.findMany({
        select: {
          id: true,
          name: true,
          serviceType: true,
          active: true,
          teams: true,
          username: true,
          hostname: true,
          tls: true,
          clientId: true,
          redirectUri: true,
        },
      });

      reply.send({
        success: true,
        queues: queues,
      });
    }
  );

  // Delete an email queue
  fastify.delete<{
    Body: {
      id: string;
    };
  }>(
    "/api/v1/email-queue/delete",
    {
      preHandler: requirePermission(["settings::manage"]),
      schema: {
        body: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
            required: ["success"],
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.body;

      await prisma.emailQueue.delete({
        where: {
          id: id,
        },
      });

      reply.send({
        success: true,
      });
    }
  );
}
