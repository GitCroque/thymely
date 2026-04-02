import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

const UPLOADS_DIR = "uploads";
const UPLOADS_ROOT = path.resolve(UPLOADS_DIR);

const fileSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    filename: { type: "string" },
    mime: { type: "string" },
    size: { type: "number" },
    ticketId: { type: "string", format: "uuid" },
    userId: { type: "string", format: "uuid" },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["id", "filename", "mime", "size", "ticketId", "userId", "createdAt"],
};

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function resolveStoredPath(storedPath: string) {
  const absolutePath = path.resolve(storedPath);
  const normalizedRoot = `${UPLOADS_ROOT}${path.sep}`;

  if (absolutePath !== UPLOADS_ROOT && !absolutePath.startsWith(normalizedRoot)) {
    throw new Error("Stored file path is outside uploads directory");
  }

  return absolutePath;
}

function sanitizeDownloadFilename(filename: string) {
  return path.basename(filename).replace(/[\r\n"]/g, "_");
}

export function objectStoreRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { ticketId: string } }>(
    "/api/v1/storage/ticket/:ticketId/upload/single",
    {
      preHandler: [requirePermission(["issue::update"])],
      schema: {
        params: {
          type: "object",
          properties: {
            ticketId: { type: "string", format: "uuid" },
          },
          required: ["ticketId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              file: fileSchema,
            },
            required: ["success", "file"],
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { ticketId: string } }>,
      reply: FastifyReply
    ) => {
      const session = await checkSession(request);
      if (!session) {
        return reply.code(401).send({
          message: "Unauthorized",
          success: false,
        });
      }

      const { ticketId } = request.params;

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) {
        return reply.code(404).send({
          message: "Ticket not found",
          success: false,
        });
      }

      const data = await request.file();

      if (!data) {
        return reply.code(400).send({
          message: "No file uploaded",
          success: false,
        });
      }

      if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
        return reply.code(400).send({
          message: "File type not allowed",
          success: false,
        });
      }

      ensureUploadsDir();

      const filename = `${Date.now()}-${path.basename(data.filename)}`;
      const filepath = path.join(UPLOADS_DIR, filename);
      await pipeline(data.file, fs.createWriteStream(filepath));

      // Check if the stream was truncated (file too large)
      if (data.file.truncated) {
        fs.unlinkSync(filepath);
        return reply.code(400).send({
          message: "File too large (max 10MB)",
          success: false,
        });
      }

      const stat = fs.statSync(filepath);

      const createdFile = await prisma.ticketFile.create({
        data: {
          ticketId,
          filename: data.filename,
          path: filepath,
          mime: data.mimetype,
          size: stat.size,
          encoding: data.encoding,
          userId: session.id,
        },
      });

      reply.send({
        success: true,
        file: createdFile,
      });
    }
  );

  fastify.get<{ Params: { ticketId: string } }>(
    "/api/v1/storage/ticket/:ticketId/files",
    {
      preHandler: [requirePermission(["issue::read"])],
      schema: {
        params: {
          type: "object",
          properties: {
            ticketId: { type: "string", format: "uuid" },
          },
          required: ["ticketId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              files: {
                type: "array",
                items: fileSchema,
              },
            },
            required: ["success", "files"],
          },
        },
      },
    },
    async (request, reply) => {
      const { ticketId } = request.params;

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) {
        return reply.code(404).send({
          message: "Ticket not found",
          success: false,
        });
      }

      const files = await prisma.ticketFile.findMany({
        where: {
          ticketId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      reply.send({
        success: true,
        files,
      });
    }
  );

  fastify.get<{ Params: { fileId: string } }>(
    "/api/v1/storage/file/:fileId/download",
    {
      preHandler: [requirePermission(["issue::read"])],
      schema: {
        params: {
          type: "object",
          properties: {
            fileId: { type: "string", format: "uuid" },
          },
          required: ["fileId"],
        },
      },
    },
    async (request, reply) => {
      const { fileId } = request.params;
      const file = await prisma.ticketFile.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        return reply.code(404).send({
          message: "File not found",
          success: false,
        });
      }

      let absolutePath: string;
      try {
        absolutePath = resolveStoredPath(file.path);
      } catch {
        return reply.code(500).send({
          message: "Stored file path is invalid",
          success: false,
        });
      }

      try {
        await fsPromises.access(absolutePath);
      } catch {
        return reply.code(404).send({
          message: "File content not found",
          success: false,
        });
      }

      reply.header("Content-Type", file.mime);
      reply.header(
        "Content-Disposition",
        `attachment; filename="${sanitizeDownloadFilename(file.filename)}"`
      );

      return reply.send(fs.createReadStream(absolutePath));
    }
  );

  fastify.delete<{ Params: { fileId: string } }>(
    "/api/v1/storage/file/:fileId",
    {
      preHandler: [requirePermission(["issue::update"])],
      schema: {
        params: {
          type: "object",
          properties: {
            fileId: { type: "string", format: "uuid" },
          },
          required: ["fileId"],
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
      const { fileId } = request.params;
      const file = await prisma.ticketFile.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        return reply.code(404).send({
          message: "File not found",
          success: false,
        });
      }

      try {
        const absolutePath = resolveStoredPath(file.path);
        await fsPromises.unlink(absolutePath);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== "ENOENT") {
          return reply.code(500).send({
            message: "Failed to delete file from disk",
            success: false,
          });
        }
      }

      await prisma.ticketFile.delete({
        where: { id: fileId },
      });

      reply.send({
        success: true,
      });
    }
  );
}
