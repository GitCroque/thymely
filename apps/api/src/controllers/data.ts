import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requirePermission } from "../lib/roles";
import { prisma } from "../prisma";

export function dataRoutes(fastify: FastifyInstance) {
  // Get total count of all tickets
  fastify.get(
    "/api/v1/data/tickets/all",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await prisma.ticket.count({
        where: { hidden: false },
      });

      reply.send({ count: result });
    }
  );

  // Get total count of all completed tickets
  fastify.get(
    "/api/v1/data/tickets/completed",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await prisma.ticket.count({
        where: { isComplete: true, hidden: false },
      });

      reply.send({ count: result });
    }
  );

  // Get total count of all open tickets
  fastify.get(
    "/api/v1/data/tickets/open",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await prisma.ticket.count({
        where: { isComplete: false, hidden: false },
      });

      reply.send({ count: result });
    }
  );

  // Get total of all unsassigned tickets
  fastify.get(
    "/api/v1/data/tickets/unassigned",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await prisma.ticket.count({
        where: { userId: null, hidden: false, isComplete: false },
      });

      reply.send({ count: result });
    }
  );

  // Get all logs
  fastify.get(
    "/api/v1/data/logs",
    { preHandler: requirePermission(["settings::manage"]) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const logs = await import("fs/promises").then((fs) =>
        fs.readFile("logs.log", "utf-8")
      );

      // Avoid returning unbounded data and reduce accidental secret leakage.
      const maxChars = 50_000;
      const safeLogs =
        logs.length > maxChars ? logs.slice(logs.length - maxChars) : logs;

      const SENSITIVE_PATTERNS = /eyJ[A-Za-z0-9_-]{10,}|password["\s:=]+[^\s,}]+|secret["\s:=]+[^\s,}]+|token["\s:=]+[^\s,}]+/gi;
      const redactedLogs = safeLogs.replace(SENSITIVE_PATTERNS, "[REDACTED]");
      reply.send({ logs: redactedLogs });
    }
  );
}
