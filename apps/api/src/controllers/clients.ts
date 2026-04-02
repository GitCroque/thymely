import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { auditLog } from "../lib/audit";
import { track } from "../lib/hog";
import { parsePagination } from "../lib/pagination";
import { requirePermission } from "../lib/roles";
import { prisma } from "../prisma";

const paginationQuerySchema = {
  type: "object",
  properties: {
    page: { type: "string", pattern: "^[0-9]+$" },
    limit: { type: "string", pattern: "^[0-9]+$" },
  },
};

const successResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
  },
  required: ["success"],
};

export function clientRoutes(fastify: FastifyInstance) {
  // Register a new client
  fastify.post<{
    Body: {
      name: string;
      email: string;
      number: string | undefined;
      contactName: string;
    };
  }>(
    "/api/v1/client/create",
    {
      preHandler: requirePermission(["client::create"]),
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 200 },
            email: { type: "string", format: "email", maxLength: 254 },
            number: { type: "string", maxLength: 50 },
            contactName: { type: "string", maxLength: 200 },
          },
          required: ["name"],
          additionalProperties: false,
        },
        response: {
          200: successResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { name, email, number, contactName } = request.body;

      const client = await prisma.client.create({
        data: {
          name,
          contactName,
          email,
          number: String(number),
        },
      });

      const hog = track();

      hog.capture({
        event: "client_created",
        distinctId: client.id,
      });

      reply.send({
        success: true,
      });
    }
  );

  // Update client
  fastify.post<{
    Body: {
      id: string;
      name: string | undefined;
      email: string | undefined;
      number: string | undefined;
      contactName: string | undefined;
    };
  }>(
    "/api/v1/client/update",
    {
      preHandler: requirePermission(["client::update"]),
      schema: {
        body: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", maxLength: 200 },
            email: { type: "string", format: "email", maxLength: 254 },
            number: { type: "string", maxLength: 50 },
            contactName: { type: "string", maxLength: 200 },
          },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: successResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { name, email, number, contactName, id } = request.body;

      await prisma.client.update({
        where: { id: id },
        data: {
          name,
          contactName,
          email,
          number: String(number),
        },
      });

      await auditLog(request, { action: "client.update", metadata: { clientId: id } });

      reply.send({
        success: true,
      });
    }
  );

  // Get all clients
  fastify.get(
    "/api/v1/clients/all",
    {
      preHandler: requirePermission(["client::read"]),
      schema: {
        querystring: paginationQuerySchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              clients: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    email: { type: "string", nullable: true },
                    number: { type: "string", nullable: true },
                    contactName: { type: "string", nullable: true },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                  required: ["id", "name", "createdAt", "updatedAt"],
                },
              },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "number" },
                  limit: { type: "number" },
                  total: { type: "number" },
                },
                required: ["page", "limit", "total"],
              },
            },
            required: ["success", "clients", "pagination"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { isDeleted: false };

      const [clients, total] = await Promise.all([
        prisma.client.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
        prisma.client.count({ where }),
      ]);

      reply.send({
        success: true,
        clients,
        pagination: { page, limit, total },
      });
    }
  );

  // Delete client
  fastify.delete<{
    Params: {
      id: string;
    };
  }>(
    "/api/v1/clients/:id/delete-client",
    {
      preHandler: requirePermission(["client::delete"]),
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        response: {
          200: successResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      await prisma.client.update({
        where: { id: id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      await auditLog(request, { action: "client.delete", target: "Client", targetId: id });

      reply.send({
        success: true,
      });
    }
  );
}
