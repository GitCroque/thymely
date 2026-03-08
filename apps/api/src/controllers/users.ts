import bcrypt from "bcrypt";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { track } from "../lib/hog";
import { parsePagination } from "../lib/pagination";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

export function userRoutes(fastify: FastifyInstance) {
  // All users
  fastify.get(
    "/api/v1/users/all",
    {
      preHandler: requirePermission(["user::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { skip, take, page, limit } = parsePagination(request.query as { page?: string; limit?: string });

      const where = { external_user: false, isDeleted: false };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take,
          select: {
            id: true,
            name: true,
            email: true,
            isAdmin: true,
            createdAt: true,
            updatedAt: true,
            language: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      reply.send({
        users,
        pagination: { page, limit, total },
        success: true,
      });
    }
  );

  // New user
  fastify.post<{
    Body: {
      email: string;
      password: string;
      name: string;
      admin: boolean | undefined;
    };
  }>(
    "/api/v1/user/new",
    {
      preHandler: requirePermission(["user::manage"]),
      schema: {
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email", maxLength: 254 },
            password: { type: "string", minLength: 8, maxLength: 128 },
            name: { type: "string", maxLength: 200 },
            admin: { type: "boolean" },
          },
          required: ["email", "password", "name"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const session = await checkSession(request);

      if (session!.isAdmin) {
        const { email, password, name, admin } = request.body;

        const e = email.toLowerCase();

        const hash = await bcrypt.hash(password, 12);

        await prisma.user.create({
          data: {
            name,
            email: e,
            password: hash,
            isAdmin: admin,
          },
        });

        const client = track();

        client.capture({
          event: "user_created",
          distinctId: "uuid",
        });

        client.shutdownAsync();

        reply.send({
          success: true,
        });
      } else {
        reply.status(403).send({ message: "Unauthorized", failed: true });
      }
    }
  );

  // (ADMIN) Reset password
  fastify.put<{
    Body: {
      password: string;
      id: string;
    };
  }>(
    "/api/v1/user/reset-password",
    {
      preHandler: requirePermission(["user::manage"]),
      schema: {
        body: {
          type: "object",
          properties: {
            password: { type: "string", minLength: 8, maxLength: 128 },
            id: { type: "string", format: "uuid" },
          },
          required: ["password", "id"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { password, id } = request.body;

      const session = await checkSession(request);

      if (session!.isAdmin) {
        const hashedPass = await bcrypt.hash(password, 12);
        await prisma.user.update({
          where: { id: id },
          data: {
            password: hashedPass,
          },
        });
        reply
          .status(201)
          .send({ message: "password updated success", failed: false });
      } else {
        reply.status(403).send({ message: "Unauthorized", failed: true });
      }
    }
  );

  // Mark Notification as read
  fastify.get<{
    Params: {
      id: string;
    };
  }>(
    "/api/v1/user/notifcation/:id",
    async (request, reply) => {
      const { id } = request.params;
      const session = await checkSession(request);
      
      if (!session) {
        return reply.code(401).send({
          message: "Unauthorized",
          success: false,
        });
      }

      // Get the notification and verify it belongs to the user
      const notification = await prisma.notifications.findUnique({
        where: { id: id }
      });
      
      if (!notification) {
        return reply.code(404).send({
          message: "Notification not found",
          success: false,
        });
      }
      
      if (notification.userId !== session.id) {
        return reply.code(403).send({
          message: "Access denied. You can only manage your own notifications.",
          success: false,
        });
      }

      await prisma.notifications.update({
        where: { id: id },
        data: {
          read: true,
        },
      });

      reply.send({
        success: true,
      });
    }
  );
}
