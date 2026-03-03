import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import multer from "fastify-multer";
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

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (
    _req: any,
    file: { mimetype: string },
    cb: (error: Error | null, acceptFile?: boolean) => void
  ) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"));
    }
  },
});

export function objectStoreRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/v1/storage/ticket/:id/upload/single",
    {
      preHandler: [
        requirePermission(["issue::update"]),
        upload.single("file"),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await checkSession(request);
      if (!session) {
        return reply.code(401).send({
          message: "Unauthorized",
          success: false,
        });
      }

      const { id } = request.params as { id: string };
      const file = (request as any).file;

      if (!file) {
        return reply.code(400).send({
          message: "No file uploaded",
          success: false,
        });
      }

      await prisma.ticketFile.create({
        data: {
          ticketId: id,
          filename: file.originalname,
          path: file.path,
          mime: file.mimetype,
          size: file.size,
          encoding: file.encoding,
          userId: session.id,
        },
      });

      reply.send({
        success: true,
      });
    }
  );
}
