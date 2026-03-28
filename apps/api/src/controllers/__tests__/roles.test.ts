import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const {
  mockRoleFindMany,
  mockRoleCount,
  mockRoleUpdate,
  mockConfigFindFirst,
  mockCheckSession,
  mockAuditLog,
} = vi.hoisted(() => ({
  mockRoleFindMany: vi.fn(),
  mockRoleCount: vi.fn(),
  mockRoleUpdate: vi.fn(),
  mockConfigFindFirst: vi.fn(),
  mockCheckSession: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock("../../prisma", () => ({
  prisma: {
    role: {
      findMany: mockRoleFindMany,
      count: mockRoleCount,
      update: mockRoleUpdate,
    },
    config: {
      findFirst: mockConfigFindFirst,
    },
  },
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
}));

vi.mock("../../lib/session", () => ({
  checkSession: (...args: unknown[]) => mockCheckSession(...args),
}));

vi.mock("../../lib/audit", () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

vi.mock("../../lib/hog", () => ({
  track: () => ({ capture: vi.fn(), shutdownAsync: vi.fn() }),
}));

import { roleRoutes } from "../roles";

describe("Roles controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    roleRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckSession.mockResolvedValue({ id: "admin-1" });
    mockConfigFindFirst.mockResolvedValue({ roles_active: true });
  });

  it("returns roles with the active flag", async () => {
    mockRoleFindMany.mockResolvedValueOnce([
      {
        id: "role-1",
        name: "Support",
        permissions: [],
        users: [],
        active: true,
      },
    ]);
    mockRoleCount.mockResolvedValueOnce(1);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/roles/all",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().roles[0].active).toBe(true);
  });

  it("toggles a role active state", async () => {
    mockRoleUpdate.mockResolvedValueOnce({
      id: "role-1",
      active: false,
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/role/550e8400-e29b-41d4-a716-446655440000/toggle",
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRoleUpdate).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440000" },
      data: expect.objectContaining({ active: false }),
    });
    expect(mockAuditLog).toHaveBeenCalled();
  });

  it("returns 404 when toggling an unknown role", async () => {
    mockRoleUpdate.mockRejectedValueOnce({ code: "P2025" });

    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/role/550e8400-e29b-41d4-a716-446655440000/toggle",
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().message).toBe("Role not found");
  });
});
