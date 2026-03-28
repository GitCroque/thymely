import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

// --- Mocks (same pattern as validation.test.ts) ---

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
    user: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({}) },
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
vi.mock("axios", () => ({ default: { post: vi.fn().mockResolvedValue({}) } }));
vi.mock("sanitize-html", () => ({ default: (html: string) => html }));

// --- Imports (after mocks) ---

import { ticketRoutes } from "../ticket";
import { prisma } from "../../prisma";
import { checkSession } from "../../lib/session";
import { sendTicketCreate } from "../../lib/nodemailer/ticket/create";
import { sendComment } from "../../lib/nodemailer/ticket/comment";
import { sendTicketStatus } from "../../lib/nodemailer/ticket/status";
import { sendAssignedEmail } from "../../lib/nodemailer/ticket/assigned";
import { assignedNotification } from "../../lib/notifications/issue/assigned";
import { commentNotification } from "../../lib/notifications/issue/comment";
import { activeStatusNotification } from "../../lib/notifications/issue/status";
import { sendWebhookNotification } from "../../lib/notifications/webhook";
import { auditLog } from "../../lib/audit";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "550e8400-e29b-41d4-a716-446655440001";

describe("Ticket controller business logic", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    ticketRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default session mock
    vi.mocked(checkSession).mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      isAdmin: true,
    } as any);
  });

  // ─── POST /api/v1/ticket/create (authenticated) ───

  describe("POST /api/v1/ticket/create", () => {
    it("creates a ticket and returns success with id", async () => {
      vi.mocked(prisma.ticket.create).mockResolvedValueOnce({ id: UUID, email: null } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: { title: "Bug report" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.id).toBe(UUID);
    });

    it("calls sendTicketCreate when ticket has a valid email", async () => {
      vi.mocked(prisma.ticket.create).mockResolvedValueOnce({
        id: UUID,
        email: "client@example.com",
      } as any);

      await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: { title: "With email", email: "client@example.com" },
      });

      expect(sendTicketCreate).toHaveBeenCalledOnce();
    });

    it("does not call sendTicketCreate when no email provided", async () => {
      vi.mocked(prisma.ticket.create).mockResolvedValueOnce({ id: UUID, email: null } as any);

      await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: { title: "No email" },
      });

      expect(sendTicketCreate).not.toHaveBeenCalled();
    });

    it("calls sendAssignedEmail and assignedNotification when engineer is assigned", async () => {
      vi.mocked(prisma.ticket.create).mockResolvedValueOnce({
        id: UUID,
        email: null,
        userId: UUID2,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: UUID2,
        email: "engineer@example.com",
        name: "Engineer",
      } as any);

      await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: {
          title: "Assigned ticket",
          engineer: { id: UUID2, name: "Engineer" },
        },
      });

      expect(sendAssignedEmail).toHaveBeenCalledWith("engineer@example.com");
      expect(assignedNotification).toHaveBeenCalledOnce();
    });

    it("does not send assignment emails when engineer is Unassigned", async () => {
      vi.mocked(prisma.ticket.create).mockResolvedValueOnce({ id: UUID, email: null } as any);

      await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: {
          title: "Unassigned",
          engineer: { id: UUID2, name: "Unassigned" },
        },
      });

      expect(sendAssignedEmail).not.toHaveBeenCalled();
      expect(assignedNotification).not.toHaveBeenCalled();
    });

    it("dispatches webhook notifications for ticket_created", async () => {
      vi.mocked(prisma.ticket.create).mockResolvedValueOnce({ id: UUID, email: null } as any);
      vi.mocked(prisma.webhooks.findMany).mockResolvedValueOnce([
        { id: "wh-1", url: "https://hook.example.com", type: "ticket_created", active: true, secret: null },
      ] as any);

      await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: { title: "Webhook test" },
      });

      expect(sendWebhookNotification).toHaveBeenCalledOnce();
    });

    it("calls auditLog for authenticated ticket creation", async () => {
      vi.mocked(prisma.ticket.create).mockResolvedValueOnce({ id: UUID, email: null } as any);

      await app.inject({
        method: "POST",
        url: "/api/v1/ticket/create",
        payload: { title: "Audited" },
      });

      expect(auditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: "ticket.create", userId: "user-1", targetId: UUID })
      );
    });
  });

  // ─── POST /api/v1/ticket/public/create (no auth) ───

  describe("POST /api/v1/ticket/public/create", () => {
    it("creates a ticket without authentication", async () => {
      vi.mocked(prisma.ticket.create).mockResolvedValueOnce({ id: UUID, email: null } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/public/create",
        payload: { title: "Public ticket" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("does not call auditLog for public (unauthenticated) ticket creation", async () => {
      vi.mocked(prisma.ticket.create).mockResolvedValueOnce({ id: UUID, email: null } as any);

      await app.inject({
        method: "POST",
        url: "/api/v1/ticket/public/create",
        payload: { title: "Public no audit" },
      });

      expect(auditLog).not.toHaveBeenCalled();
    });
  });

  // ─── GET /api/v1/ticket/:id ───

  describe("GET /api/v1/ticket/:id", () => {
    it("returns 404 when ticket is not found", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/ticket/${UUID}`,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().success).toBe(false);
    });

    it("returns ticket with comments, files, and time tracking when found", async () => {
      const ticket = { id: UUID, title: "Found", client: null, assignedTo: null };
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(ticket as any);
      vi.mocked(prisma.timeTracking.findMany).mockResolvedValueOnce([{ id: "tt-1" }] as any);
      vi.mocked(prisma.comment.findMany).mockResolvedValueOnce([{ id: "c-1", text: "hello" }] as any);
      vi.mocked(prisma.ticketFile.findMany).mockResolvedValueOnce([{ id: "f-1" }] as any);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/ticket/${UUID}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.ticket.id).toBe(UUID);
      expect(body.ticket.comments).toHaveLength(1);
      expect(body.ticket.TimeTracking).toHaveLength(1);
      expect(body.ticket.files).toHaveLength(1);
    });
  });

  // ─── PUT /api/v1/ticket/status/update ───

  describe("PUT /api/v1/ticket/status/update", () => {
    it("marks a ticket as completed and sends notifications", async () => {
      const updatedTicket = {
        id: UUID,
        title: "Ticket title",
        Number: 42,
        email: "user@test.com",
        isComplete: true,
      };
      vi.mocked(prisma.ticket.update).mockResolvedValueOnce(updatedTicket as any);
      vi.mocked(prisma.webhooks.findMany).mockResolvedValueOnce([]);

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/ticket/status/update",
        payload: { status: true, id: UUID },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(activeStatusNotification).toHaveBeenCalledWith(
        updatedTicket,
        expect.anything(),
        "Completed"
      );
      expect(sendTicketStatus).toHaveBeenCalledWith({
        title: "Ticket title",
        Number: 42,
        email: "user@test.com",
        isComplete: true,
      });
    });

    it("marks a ticket as outstanding with correct status label", async () => {
      const updatedTicket = { id: UUID, email: null, isComplete: false };
      vi.mocked(prisma.ticket.update).mockResolvedValueOnce(updatedTicket as any);
      vi.mocked(prisma.webhooks.findMany).mockResolvedValueOnce([]);

      await app.inject({
        method: "PUT",
        url: "/api/v1/ticket/status/update",
        payload: { status: false, id: UUID },
      });

      expect(activeStatusNotification).toHaveBeenCalledWith(
        updatedTicket,
        expect.anything(),
        "Outstanding"
      );
    });

    it("dispatches status webhooks when configured", async () => {
      vi.mocked(prisma.ticket.update).mockResolvedValueOnce({ id: UUID, email: null } as any);
      vi.mocked(prisma.webhooks.findMany).mockResolvedValueOnce([
        { id: "wh-1", url: "https://hook.example.com", type: "ticket_status_changed", active: true, secret: null },
      ] as any);

      await app.inject({
        method: "PUT",
        url: "/api/v1/ticket/status/update",
        payload: { status: true, id: UUID },
      });

      // axios.post is called for non-discord webhooks
      const axios = (await import("axios")).default;
      expect(axios.post).toHaveBeenCalled();
    });
  });

  // ─── POST /api/v1/ticket/delete ───

  describe("POST /api/v1/ticket/delete", () => {
    it("soft deletes a ticket and calls auditLog", async () => {
      vi.mocked(prisma.ticket.update).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/delete",
        payload: { id: UUID },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UUID },
          data: expect.objectContaining({ isDeleted: true, deletedBy: "user-1" }),
        })
      );
      expect(auditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: "ticket.delete", targetId: UUID })
      );
    });
  });

  // ─── POST /api/v1/ticket/transfer ───

  describe("POST /api/v1/ticket/transfer", () => {
    it("assigns a user to a ticket and sends notification emails", async () => {
      const assignedUser = { id: UUID2, email: "assigned@test.com", name: "Assigned" };
      vi.mocked(prisma.user.update).mockResolvedValueOnce(assignedUser as any);
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({ id: UUID, title: "Test" } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/transfer",
        payload: { user: UUID2, id: UUID },
      });

      expect(res.statusCode).toBe(200);
      expect(sendAssignedEmail).toHaveBeenCalledWith("assigned@test.com");
      expect(assignedNotification).toHaveBeenCalledOnce();
    });

    it("unassigns a user when no user id is provided", async () => {
      vi.mocked(prisma.ticket.update).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/transfer",
        payload: { id: UUID },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UUID },
          data: { userId: null },
        })
      );
      expect(sendAssignedEmail).not.toHaveBeenCalled();
    });
  });

  // ─── POST /api/v1/ticket/transfer/client ───

  describe("POST /api/v1/ticket/transfer/client", () => {
    it("assigns a client to a ticket", async () => {
      vi.mocked(prisma.ticket.update).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/transfer/client",
        payload: { client: UUID2, id: UUID },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UUID },
          data: { clientId: UUID2 },
        })
      );
    });

    it("removes client assignment when no client id is provided", async () => {
      vi.mocked(prisma.ticket.update).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/transfer/client",
        payload: { id: UUID },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UUID },
          data: { clientId: null },
        })
      );
    });
  });

  // ─── POST /api/v1/ticket/comment ───

  describe("POST /api/v1/ticket/comment", () => {
    it("creates a comment and calls commentNotification", async () => {
      vi.mocked(prisma.comment.create).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: UUID,
        title: "Test",
        email: null,
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/comment",
        payload: { text: "A comment", id: UUID },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(prisma.comment.create).toHaveBeenCalledOnce();
      expect(commentNotification).toHaveBeenCalledOnce();
    });

    it("sends email when comment is public and ticket has an email", async () => {
      vi.mocked(prisma.comment.create).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: UUID,
        title: "Email ticket",
        email: "client@example.com",
      } as any);

      await app.inject({
        method: "POST",
        url: "/api/v1/ticket/comment",
        payload: { text: "Public reply", id: UUID, public: true },
      });

      expect(sendComment).toHaveBeenCalledWith(
        "Public reply",
        "Email ticket",
        UUID,
        "client@example.com"
      );
    });

    it("does not send email when comment is not public", async () => {
      vi.mocked(prisma.comment.create).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: UUID,
        title: "Test",
        email: "client@example.com",
      } as any);

      await app.inject({
        method: "POST",
        url: "/api/v1/ticket/comment",
        payload: { text: "Internal note", id: UUID },
      });

      expect(sendComment).not.toHaveBeenCalled();
    });

    it("does not send email when ticket has no email even if comment is public", async () => {
      vi.mocked(prisma.comment.create).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: UUID,
        title: "No email",
        email: null,
      } as any);

      await app.inject({
        method: "POST",
        url: "/api/v1/ticket/comment",
        payload: { text: "Public but no email", id: UUID, public: true },
      });

      expect(sendComment).not.toHaveBeenCalled();
    });
  });

  // ─── POST /api/v1/ticket/comment/delete ───

  describe("POST /api/v1/ticket/comment/delete", () => {
    it("returns 404 when comment is not found", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/comment/delete",
        payload: { id: UUID },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toBe("Comment not found");
    });

    it("returns 403 when non-admin tries to delete another user's comment", async () => {
      vi.mocked(checkSession).mockResolvedValueOnce({
        id: "user-1",
        email: "test@test.com",
        name: "Test",
        isAdmin: false,
      } as any);
      vi.mocked(prisma.comment.findUnique).mockResolvedValueOnce({
        id: UUID,
        userId: "other-user",
        text: "Someone else's comment",
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/comment/delete",
        payload: { id: UUID },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toBe("Not authorized to delete this comment");
    });

    it("soft deletes own comment and calls auditLog", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValueOnce({
        id: UUID,
        userId: "user-1",
        text: "My comment",
      } as any);
      vi.mocked(prisma.comment.update).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/comment/delete",
        payload: { id: UUID },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UUID },
          data: expect.objectContaining({ isDeleted: true, deletedBy: "user-1" }),
        })
      );
      expect(auditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: "comment.delete", targetId: UUID })
      );
    });

    it("allows admin to delete another user's comment", async () => {
      vi.mocked(checkSession).mockResolvedValueOnce({
        id: "user-1",
        email: "test@test.com",
        name: "Test",
        isAdmin: true,
      } as any);
      vi.mocked(prisma.comment.findUnique).mockResolvedValueOnce({
        id: UUID,
        userId: "other-user",
        text: "Not mine",
      } as any);
      vi.mocked(prisma.comment.update).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ticket/comment/delete",
        payload: { id: UUID },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.comment.update).toHaveBeenCalledOnce();
    });
  });

  // ─── GET /api/v1/tickets/open ───

  describe("GET /api/v1/tickets/open", () => {
    it("returns open tickets with pagination", async () => {
      const tickets = [{ id: UUID, title: "Open 1" }];
      vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce(tickets as any);
      vi.mocked(prisma.ticket.count).mockResolvedValueOnce(1);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/tickets/open",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.tickets).toHaveLength(1);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(1);
    });

    it("respects page and limit query parameters", async () => {
      vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.ticket.count).mockResolvedValueOnce(0);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/tickets/open?page=2&limit=10",
      });

      const body = res.json();
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(10);
    });
  });

  // ─── GET /api/v1/tickets/completed ───

  describe("GET /api/v1/tickets/completed", () => {
    it("returns completed tickets", async () => {
      const tickets = [{ id: UUID, title: "Done", isComplete: true }];
      vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce(tickets as any);
      vi.mocked(prisma.ticket.count).mockResolvedValueOnce(1);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/tickets/completed",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().tickets).toHaveLength(1);
    });
  });

  // ─── GET /api/v1/tickets/user/open ───

  describe("GET /api/v1/tickets/user/open", () => {
    it("filters tickets by the authenticated user id", async () => {
      vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.ticket.count).mockResolvedValueOnce(0);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/tickets/user/open",
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user-1" }),
        })
      );
    });
  });

  // ─── POST /api/v1/tickets/search ───

  describe("POST /api/v1/tickets/search", () => {
    it("searches tickets by title", async () => {
      const tickets = [{ id: UUID, title: "Bug in login" }];
      vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce(tickets as any);
      vi.mocked(prisma.ticket.count).mockResolvedValueOnce(1);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/tickets/search",
        payload: { query: "Bug" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().tickets).toHaveLength(1);
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ title: { contains: "Bug" } }),
        })
      );
    });

    it("returns empty results when no match", async () => {
      vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.ticket.count).mockResolvedValueOnce(0);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/tickets/search",
        payload: { query: "nonexistent" },
      });

      expect(res.json().tickets).toHaveLength(0);
      expect(res.json().pagination.total).toBe(0);
    });
  });

  // ─── GET /api/v1/ticket/subscribe/:id ───

  describe("GET /api/v1/ticket/subscribe/:id", () => {
    it("adds user to following array when not already following", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: UUID,
        following: [],
      } as any);
      vi.mocked(prisma.ticket.update).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/ticket/subscribe/${UUID}`,
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UUID },
          data: { following: ["user-1"] },
        })
      );
    });

    it("returns success false when user is already following", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: UUID,
        following: ["user-1"],
      } as any);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/ticket/subscribe/${UUID}`,
      });

      // The controller sends success: false before continuing, so we check the response
      const body = res.json();
      expect(body.message).toBe("You are already following this issue");
    });
  });

  // ─── GET /api/v1/ticket/unsubscribe/:id ───

  describe("GET /api/v1/ticket/unsubscribe/:id", () => {
    it("removes user from following array", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: UUID,
        following: ["user-1", "user-2"],
      } as any);
      vi.mocked(prisma.ticket.update).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/ticket/unsubscribe/${UUID}`,
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UUID },
          data: { following: ["user-2"] },
        })
      );
    });

    it("returns success false when user is not following", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: UUID,
        following: ["other-user"],
      } as any);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/ticket/unsubscribe/${UUID}`,
      });

      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe("You are not following this issue");
    });
  });
});
