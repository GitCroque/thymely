import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { track } from "../lib/hog";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

async function tracking(event: string, properties: any) {
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
