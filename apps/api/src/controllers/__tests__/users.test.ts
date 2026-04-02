import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const {
  mockUserFindMany,
  mockUserCount,
  mockUserCreate,
  mockUserUpdate,
  mockNotificationFindUnique,
  mockNotificationUpdate,
  mockCheckSession,
  mockTrackCapture,
  mockTrackShutdown,
  mockHash,
} = vi.hoisted(() => ({
  mockUserFindMany: vi.fn(),
  mockUserCount: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockNotificationFindUnique: vi.fn(),
  mockNotificationUpdate: vi.fn(),
  mockCheckSession: vi.fn(),
  mockTrackCapture: vi.fn(),
  mockTrackShutdown: vi.fn(),
  mockHash: vi.fn(),
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: mockHash,
  },
  hash: mockHash,
}));

vi.mock("../../prisma", () => ({
  prisma: {
    user: {
      findMany: mockUserFindMany,
      count: mockUserCount,
      create: mockUserCreate,
      update: mockUserUpdate,
    },
    notifications: {
      findUnique: mockNotificationFindUnique,
      update: mockNotificationUpdate,
    },
  },
}));

vi.mock("../../lib/session", () => ({
  checkSession: (...args: unknown[]) => mockCheckSession(...args),
}));

vi.mock("../../lib/hog", () => ({
  track: () => ({
    capture: mockTrackCapture,
    shutdownAsync: mockTrackShutdown,
  }),
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
}));

import { userRoutes } from "../users";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTIFICATION_ID = "22222222-2222-4222-8222-222222222222";

describe("User controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    userRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockHash.mockResolvedValue("hashed-password");
    mockCheckSession.mockResolvedValue({ id: USER_ID, isAdmin: true });
    mockUserFindMany.mockResolvedValue([
      {
        id: USER_ID,
        name: "Admin",
        email: "admin@example.com",
        isAdmin: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        language: "fr",
      },
    ]);
    mockUserCount.mockResolvedValue(1);
    mockUserCreate.mockResolvedValue({});
    mockUserUpdate.mockResolvedValue({});
    mockNotificationFindUnique.mockResolvedValue({
      id: NOTIFICATION_ID,
      userId: USER_ID,
    });
    mockNotificationUpdate.mockResolvedValue({});
  });

  it("retourne les utilisateurs pagines", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/users/all?page=1&limit=10",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      users: [
        expect.objectContaining({
          id: USER_ID,
          email: "admin@example.com",
        }),
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
      },
    });
  });

  it("valide le mot de passe a la creation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/user/new",
      payload: {
        email: "new@example.com",
        password: "short",
        name: "New User",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("cree un utilisateur en normalisant l'email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/user/new",
      payload: {
        email: "New@Example.com",
        password: "StrongPass123!",
        name: "New User",
        admin: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@example.com",
          password: "hashed-password",
        }),
      })
    );
  });

  it("reinitialise un mot de passe admin", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/user/reset-password",
      payload: {
        id: USER_ID,
        password: "AnotherPass123!",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message: "password updated success",
      success: true,
    });
    expect(mockUserUpdate).toHaveBeenCalledOnce();
  });

  it("refuse l'acces notification sans session", async () => {
    mockCheckSession.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/user/notification/${NOTIFICATION_ID}`,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      message: "Unauthorized",
      success: false,
    });
  });

  it("marque une notification comme lue pour son proprietaire", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/user/notification/${NOTIFICATION_ID}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(mockNotificationUpdate).toHaveBeenCalledWith({
      where: { id: NOTIFICATION_ID },
      data: { read: true },
    });
  });
});
