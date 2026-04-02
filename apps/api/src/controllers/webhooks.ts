import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { track } from "../lib/hog";
import { requirePermission } from "../lib/roles";
import { encryptSecret } from "../lib/security/secrets";
import { assertSafeWebhookUrl } from "../lib/security/webhook-url";
import { checkSession } from "../lib/session";
import { Hook } from "@prisma/client";
import { prisma } from "../prisma";

export function webhookRoutes(fastify: FastifyInstance) {
  // Create a new webhook
  fastify.post<{
    Body: {
      name: string;
      url: string;
      type: Hook;
      active: boolean;
      secret: string | undefined;
    };
  }>(
    "/api/v1/webhook/create",
    {
      preHandler: requirePermission(["webhook::create"]),
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 200 },
            url: { type: "string", maxLength: 2000 },
            type: { type: "string", enum: Object.values(Hook) },
            active: { type: "boolean" },
            secret: { type: "string", nullable: true, maxLength: 2000 },
          },
          required: ["name", "url", "type", "active"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
              success: { type: "boolean" },
            },
            required: ["message", "success"],
          },
        },
      },
    },
    async (request, reply) => {
      const user = await checkSession(request);
      const { name, url, type, active, secret } = request.body;

      try {
        await assertSafeWebhookUrl(url);
      } catch (error) {
        return reply.status(400).send({
          message: (error as Error)?.message || "Invalid webhook URL",
          success: false,
        });
      }

      await prisma.webhooks.create({
        data: {
          name,
          url,
          type,
          active,
          secret: await encryptSecret(secret),
          createdBy: user!.id,
        },
      });

      const client = track();

      client.capture({
        event: "webhook_created",
        distinctId: "uuid",
      });

      client.shutdownAsync();

      reply.status(200).send({ message: "Hook created!", success: true });
    }
  );

  // Get all webhooks
  fastify.get(
    "/api/v1/webhooks/all",
    {
      preHandler: requirePermission(["webhook::read"]),
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              webhooks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                    name: { type: "string" },
                    url: { type: "string" },
                    type: { type: "string", enum: Object.values(Hook) },
                    active: { type: "boolean" },
                  },
                  required: ["id", "createdAt", "updatedAt", "name", "url", "type", "active"],
                },
              },
              success: { type: "boolean" },
            },
            required: ["webhooks", "success"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const webhooks = await prisma.webhooks.findMany({
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          name: true,
          url: true,
          type: true,
          active: true,
        },
      });

      reply.status(200).send({ webhooks: webhooks, success: true });
    }
  );

  // Delete a webhook
  fastify.delete<{
    Params: {
      id: string;
    };
  }>(
    "/api/v1/admin/webhook/:id/delete",
    {
      preHandler: requirePermission(["webhook::delete"]),
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
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
      const { id } = request.params;
      await prisma.webhooks.delete({
        where: {
          id: id,
        },
      });

      reply.status(200).send({ success: true });
    }
  );
}
