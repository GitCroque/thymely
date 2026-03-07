import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { auditLog } from "../lib/audit";
import { track } from "../lib/hog";
import { parsePagination } from "../lib/pagination";
import { requirePermission } from "../lib/roles";
import { prisma } from "../prisma";

export function clientRoutes(fastify: FastifyInstance) {
  // Register a new client
  fastify.post(
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
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { name, email, number, contactName }: any = request.body;

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
  fastify.post(
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
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { name, email, number, contactName, id }: any = request.body;

      await prisma.client.update({
        where: { id: id },
        data: {
          name,
          contactName,
          email,
          number: String(number),
        },
      });

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
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { isDeleted: false };

      const [clients, total] = await Promise.all([
        prisma.client.findMany({ where, skip, take }),
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
  fastify.delete(
    "/api/v1/clients/:id/delete-client",
    {
      preHandler: requirePermission(["client::delete"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id }: any = request.params;

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
