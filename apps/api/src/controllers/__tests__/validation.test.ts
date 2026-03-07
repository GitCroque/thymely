import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

// Mock all dependencies that ticket routes need
vi.mock("../../prisma", () => ({
  prisma: {
    ticket: {
      create: vi.fn().mockResolvedValue({ id: "test-id", email: null }),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    comment: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    timeTracking: { findMany: vi.fn().mockResolvedValue([]) },
    ticketFile: { findMany: vi.fn().mockResolvedValue([]) },
    emailTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    webhooks: { findMany: vi.fn().mockResolvedValue([]) },
    email: { findFirst: vi.fn().mockResolvedValue(null) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("../../lib/session", () => ({
  checkSession: vi.fn().mockResolvedValue({
    id: "user-1",
    email: "test@test.com",
    name: "Test",
    isAdmin: true,
  }),
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
}));

vi.mock("../../lib/hog", () => ({
  track: () => ({ capture: vi.fn(), shutdownAsync: vi.fn() }),
}));

vi.mock("../../lib/nodemailer/ticket/create", () => ({
  sendTicketCreate: vi.fn(),
}));
vi.mock("../../lib/nodemailer/ticket/comment", () => ({
  sendComment: vi.fn(),
}));
vi.mock("../../lib/nodemailer/ticket/status", () => ({
  sendTicketStatus: vi.fn(),
}));
vi.mock("../../lib/nodemailer/ticket/assigned", () => ({
  sendAssignedEmail: vi.fn(),
}));
vi.mock("../../lib/notifications/issue/assigned", () => ({
  assignedNotification: vi.fn(),
}));
vi.mock("../../lib/notifications/issue/comment", () => ({
  commentNotification: vi.fn(),
}));
vi.mock("../../lib/notifications/issue/priority", () => ({
  priorityNotification: vi.fn(),
}));
vi.mock("../../lib/notifications/issue/status", () => ({
  activeStatusNotification: vi.fn(),
  statusUpdateNotification: vi.fn(),
}));
vi.mock("../../lib/notifications/webhook", () => ({
  sendWebhookNotification: vi.fn(),
}));
vi.mock("../../lib/security/secrets", () => ({
  decryptSecret: vi.fn().mockResolvedValue(null),
}));
vi.mock("../../lib/security/webhook-url", () => ({
  assertSafeWebhookUrl: vi.fn(),
}));
vi.mock("../../lib/audit", () => ({
  auditLog: vi.fn(),
}));

import { ticketRoutes } from "../ticket";

describe("Ticket endpoint validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    ticketRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/v1/ticket/create", () => {
    it("rejects body without required title", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: { name: "test" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid email format", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: { title: "Test", email: "not-an-email" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid priority value", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: { title: "Test", priority: "critical" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects title exceeding maxLength", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: { title: "x".repeat(501) },
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts valid minimal body", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: { title: "Valid ticket" },
      });
      expect(res.statusCode).not.toBe(400);
    });
  });

  describe("POST /api/v1/ticket/comment", () => {
    it("rejects body without text", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/comment",
        payload: { id: "550e8400-e29b-41d4-a716-446655440000" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects non-UUID id", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/comment",
        payload: { text: "test", id: "not-a-uuid" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects text exceeding maxLength", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/comment",
        payload: {
          text: "x".repeat(10001),
          id: "550e8400-e29b-41d4-a716-446655440000",
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/v1/ticket/delete", () => {
    it("rejects non-UUID id", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/delete",
        payload: { id: "not-a-uuid" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/v1/tickets/search", () => {
    it("rejects missing query", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/tickets/search",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects query exceeding maxLength", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/tickets/search",
        payload: { query: "x".repeat(501) },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
