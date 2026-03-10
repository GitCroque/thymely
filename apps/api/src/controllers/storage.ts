import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
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

export function objectStoreRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { id: string } }>(
    "/api/v1/storage/ticket/:id/upload/single",
    {
      preHandler: [requirePermission(["issue::update"])],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await checkSession(request);
      if (!session) {
        return reply.code(401).send({
          message: "Unauthorized",
          success: false,
        });
      }

      const { id } = request.params;

      const ticket = await prisma.ticket.findUnique({ where: { id } });
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

      // Ensure uploads directory exists
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }

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

      await prisma.ticketFile.create({
        data: {
          ticketId: id,
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
      });
    }
  );
}
