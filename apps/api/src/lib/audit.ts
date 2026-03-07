import { Prisma } from "@prisma/client";
import { FastifyRequest } from "fastify";
import { prisma } from "../prisma";

interface AuditEntry {
  action: string;
  userId?: string;
  target?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export async function auditLog(request: FastifyRequest, entry: AuditEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        userId: entry.userId,
        target: entry.target,
        targetId: entry.targetId,
        metadata: entry.metadata ? (entry.metadata as Prisma.InputJsonValue) : undefined,
        ip: request.ip,
        userAgent: request.headers["user-agent"] || null,
      },
    });
  } catch (error) {
    request.log.error(error, "Failed to write audit log");
  }
}
