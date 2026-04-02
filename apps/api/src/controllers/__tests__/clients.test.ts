import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const {
  mockClientCreate,
  mockClientUpdate,
  mockClientFindMany,
  mockClientCount,
  mockAuditLog,
  mockTrackCapture,
} = vi.hoisted(() => ({
  mockClientCreate: vi.fn(),
  mockClientUpdate: vi.fn(),
  mockClientFindMany: vi.fn(),
  mockClientCount: vi.fn(),
  mockAuditLog: vi.fn(),
  mockTrackCapture: vi.fn(),
}));

vi.mock("../../prisma", () => ({
  prisma: {
    client: {
      create: mockClientCreate,
      update: mockClientUpdate,
      findMany: mockClientFindMany,
      count: mockClientCount,
    },
  },
}));

vi.mock("../../lib/audit", () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

vi.mock("../../lib/hog", () => ({
  track: () => ({ capture: mockTrackCapture, shutdownAsync: vi.fn() }),
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
}));

import { clientRoutes } from "../clients";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

describe("Client controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    clientRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientCreate.mockResolvedValue({ id: CLIENT_ID });
    mockClientFindMany.mockResolvedValue([
      {
        id: CLIENT_ID,
        name: "ACME",
        email: "contact@acme.test",
        number: "123",
        contactName: "Alice",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mockClientCount.mockResolvedValue(1);
    mockClientUpdate.mockResolvedValue({});
  });

  it("rejette la creation sans nom", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/client/create",
      payload: { email: "contact@acme.test" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("cree un client valide", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/client/create",
      payload: {
        name: "ACME",
        email: "contact@acme.test",
        number: "123",
        contactName: "Alice",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(mockClientCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "ACME",
          email: "contact@acme.test",
        }),
      })
    );
    expect(mockTrackCapture).toHaveBeenCalledOnce();
  });

  it("retourne les clients pagines", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/clients/all?page=1&limit=10",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      clients: [
        expect.objectContaining({
          id: CLIENT_ID,
          name: "ACME",
        }),
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
      },
    });
  });

  it("supprime un client en soft delete", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/clients/${CLIENT_ID}/delete-client`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(mockClientUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CLIENT_ID },
        data: expect.objectContaining({
          isDeleted: true,
        }),
      })
    );
    expect(mockAuditLog).toHaveBeenCalledOnce();
  });
});
