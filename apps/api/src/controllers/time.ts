import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

export function timeTrackingRoutes(fastify: FastifyInstance) {
  // Create a new entry
  fastify.post<{
    Body: {
      time: number;
      ticket: string;
      title: string;
    };
  }>(
    "/api/v1/time/new",
    {
      preHandler: requirePermission(["time_entry::create"]),
      schema: {
        body: {
          type: "object",
          properties: {
            time: { type: "number", minimum: 0, maximum: 10000 },
            ticket: { type: "string", format: "uuid" },
            title: { type: "string", maxLength: 500 },
          },
          required: ["time", "ticket"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { time, ticket, title } = request.body;

      const session = await checkSession(request);
      if (!session) {
        return reply.code(401).send({
          message: "Unauthorized",
          success: false,
        });
      }

      await prisma.timeTracking.create({
        data: {
          time: Number(time),
          title,
          userId: session.id,
          ticketId: ticket,
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Get all entries

  // Delete an entry
}
