import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { track } from "../lib/hog";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

const successResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
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

export function notebookRoutes(fastify: FastifyInstance) {
  // Create a new entry
  fastify.post<{
    Body: {
      content: string;
      title: string;
    };
  }>(
    "/api/v1/notebook/note/create",
    {
      preHandler: requirePermission(["document::create"]),
      schema: {
        body: {
          type: "object",
          properties: {
            content: { type: "string", maxLength: 100000 },
            title: { type: "string", maxLength: 200 },
          },
          required: ["content", "title"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              id: { type: "string", format: "uuid" },
            },
            required: ["success", "id"],
          },
        },
      },
    },
    async (request, reply) => {
      const { content, title } = request.body;
      const user = await checkSession(request);

      const data = await prisma.notes.create({
        data: {
          title,
          note: content,
          userId: user!.id,
        },
      });

      await tracking("note_created", {});

      const { id } = data;

      reply.status(200).send({ success: true, id });
    }
  );

  // Get all entries
  fastify.get(
    "/api/v1/notebooks/all",
    {
      preHandler: requirePermission(["document::read"]),
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              notebooks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    title: { type: "string" },
                    note: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                    userId: { type: "string", format: "uuid" },
                    Favourited: { type: "boolean" },
                  },
                  required: ["id", "title", "note", "createdAt", "updatedAt", "userId", "Favourited"],
                },
              },
            },
            required: ["success", "notebooks"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);

      const notebooks = await prisma.notes.findMany({
        where: { userId: user!.id },
      });

      reply.status(200).send({ success: true, notebooks: notebooks });
    }
  );

  // Get a single entry
  fastify.get<{
    Params: {
      id: string;
    };
  }>(
    "/api/v1/notebooks/note/:id",
    {
      preHandler: requirePermission(["document::read"]),
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
              note: {
                anyOf: [
                  {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      title: { type: "string" },
                      note: { type: "string" },
                      createdAt: { type: "string", format: "date-time" },
                      updatedAt: { type: "string", format: "date-time" },
                      userId: { type: "string", format: "uuid" },
                      Favourited: { type: "boolean" },
                    },
                    required: ["id", "title", "note", "createdAt", "updatedAt", "userId", "Favourited"],
                  },
                  { type: "null" },
                ],
              },
            },
            required: ["success", "note"],
          },
        },
      },
    },
    async (request, reply) => {
      const user = await checkSession(request);

      const { id } = request.params;

      const note = await prisma.notes.findUnique({
        where: { userId: user!.id, id: id },
      });

      reply.status(200).send({ success: true, note });
    }
  );

  // Delete an entry
  fastify.delete<{
    Params: {
      id: string;
    };
  }>(
    "/api/v1/notebooks/note/:id",
    {
      preHandler: requirePermission(["document::delete"]),
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
      const user = await checkSession(request);
      const { id } = request.params;

      await prisma.notes.delete({
        where: {
          id: id,
          userId: user!.id,
        },
      });

      await tracking("note_deleted", {});

      reply.status(200).send({ success: true });
    }
  );

  // Update an entry
  fastify.put<{
    Params: {
      id: string;
    };
    Body: {
      content: string;
      title: string;
    };
  }>(
    "/api/v1/notebooks/note/:id/update",
    {
      preHandler: requirePermission(["document::update"]),
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
            content: { type: "string", maxLength: 100000 },
            title: { type: "string", maxLength: 200 },
          },
          required: ["content", "title"],
          additionalProperties: false,
        },
        response: {
          200: successResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await checkSession(request);
      const { id } = request.params;
      const { content, title } = request.body;

      await prisma.notes.update({
        where: {
          id: id,
          userId: user!.id,
        },
        data: {
          title: title,
          note: content,
        },
      });

      await tracking("note_updated", {});

      reply.status(200).send({ success: true });
    }
  );
}
