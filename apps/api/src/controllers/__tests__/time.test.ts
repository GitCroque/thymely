import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

// --- Mocks ---

vi.mock("../../prisma", () => ({
  prisma: {
    timeTracking: {
      create: vi.fn().mockResolvedValue({}),
    },
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

// --- Imports (after mocks) ---

import { timeTrackingRoutes } from "../time";
import { prisma } from "../../prisma";
import { checkSession } from "../../lib/session";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("TimeTracking controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    timeTrackingRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkSession).mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      isAdmin: true,
    } as any);
  });

  describe("POST /api/v1/time/new", () => {
    it("creates a time entry", async () => {
      vi.mocked(prisma.timeTracking.create).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/time/new",
        payload: {
          time: 120,
          ticket: UUID,
          title: "Bug investigation",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(prisma.timeTracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          time: 120,
          title: "Bug investigation",
          userId: "user-1",
          ticketId: UUID,
        }),
      });
    });

    it("creates entry without title (optional)", async () => {
      vi.mocked(prisma.timeTracking.create).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/time/new",
        payload: {
          time: 60,
          ticket: UUID,
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it("returns 401 when not authenticated", async () => {
      vi.mocked(checkSession).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/time/new",
        payload: {
          time: 30,
          ticket: UUID,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it("rejects negative time (schema validation)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/time/new",
        payload: {
          time: -5,
          ticket: UUID,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects time over maximum (schema validation)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/time/new",
        payload: {
          time: 99999,
          ticket: UUID,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/time/new",
        payload: {
          title: "No time or ticket",
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid ticket UUID format", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/time/new",
        payload: {
          time: 30,
          ticket: "not-a-uuid",
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("strips additional properties silently (Fastify removeAdditional)", async () => {
      vi.mocked(prisma.timeTracking.create).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/time/new",
        payload: {
          time: 30,
          ticket: UUID,
          malicious: "data",
        },
      });

      // Fastify strips unknown properties by default; the request succeeds
      expect(res.statusCode).toBe(200);
      // Verify the malicious field was not passed to Prisma
      expect(prisma.timeTracking.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ malicious: "data" }),
      });
    });
  });
});
