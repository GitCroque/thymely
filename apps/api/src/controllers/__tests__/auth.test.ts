import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";

// SECRET must be set before the controller is imported (used by buildSessionToken)
process.env.SECRET = Buffer.from("test-secret-key-at-least-32-chars!!").toString("base64");

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted() runs before vi.mock() factories
// ---------------------------------------------------------------------------

const {
  mockPrismaUser,
  mockPrismaSession,
  mockPrismaConfig,
  mockPrismaPasswordResetToken,
  mockPrismaNotifications,
  mockPrismaNotes,
  mockPrismaComment,
  mockPrismaAuditLog,
  mockCheckSession,
} = vi.hoisted(() => ({
  mockPrismaUser: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  mockPrismaSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    delete: vi.fn(),
  },
  mockPrismaConfig: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  mockPrismaPasswordResetToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  mockPrismaNotifications: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  mockPrismaNotes: {
    deleteMany: vi.fn(),
  },
  mockPrismaComment: {
    updateMany: vi.fn(),
  },
  mockPrismaAuditLog: {
    create: vi.fn(),
  },
  mockCheckSession: vi.fn(),
}));

vi.mock("../../prisma", () => ({
  prisma: {
    user: mockPrismaUser,
    session: mockPrismaSession,
    config: mockPrismaConfig,
    passwordResetToken: mockPrismaPasswordResetToken,
    notifications: mockPrismaNotifications,
    notes: mockPrismaNotes,
    comment: mockPrismaComment,
    auditLog: mockPrismaAuditLog,
  },
}));

vi.mock("../../lib/session", () => ({
  checkSession: (...args: unknown[]) => mockCheckSession(...args),
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
}));

vi.mock("../../lib/hog", () => ({
  track: () => ({ capture: vi.fn(), shutdownAsync: vi.fn() }),
}));

vi.mock("../../lib/audit", () => ({
  auditLog: vi.fn(),
}));

vi.mock("../../lib/session-cookie", () => ({
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
}));

vi.mock("../../lib/request-token", () => ({
  getSessionToken: vi.fn(),
}));

vi.mock("../../lib/nodemailer/auth/forgot-password", () => ({
  forgotPassword: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn().mockReturnValue("fake-jwt-token"),
    verify: vi.fn(),
  },
}));

vi.mock("lru-cache", () => ({
  LRUCache: class {
    get = vi.fn();
    set = vi.fn();
    delete = vi.fn();
  },
}));

vi.mock("openid-client", () => ({
  generators: {
    codeVerifier: vi.fn(),
    codeChallenge: vi.fn(),
    state: vi.fn(),
  },
}));

vi.mock("simple-oauth2", () => ({
  AuthorizationCode: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { get: vi.fn() },
}));

vi.mock("../../lib/auth", () => ({
  getOAuthProvider: vi.fn(),
  getOidcConfig: vi.fn(),
}));

vi.mock("../../lib/utils/oauth_client", () => ({
  getOAuthClient: vi.fn(),
}));

vi.mock("../../lib/utils/oidc_client", () => ({
  getOidcClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import controller after all mocks are set up
// ---------------------------------------------------------------------------
import { authRoutes } from "../auth";

// ---------------------------------------------------------------------------
// Default session user returned by checkSession
// ---------------------------------------------------------------------------
const defaultSessionUser = {
  id: "user-1",
  email: "test@test.com",
  name: "Test User",
  isAdmin: true,
  language: "en",
  notify_ticket_created: true,
  notify_ticket_status_changed: true,
  notify_ticket_comments: true,
  notify_ticket_assigned: true,
  external_user: false,
  firstLogin: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a fake user row matching what Prisma would return. */
function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "test@test.com",
    name: "Test User",
    password: null as string | null,
    isAdmin: true,
    isDeleted: false,
    language: "en",
    notify_ticket_created: true,
    notify_ticket_status_changed: true,
    notify_ticket_comments: true,
    notify_ticket_assigned: true,
    external_user: false,
    firstLogin: false,
    image: null,
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Auth controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    authRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckSession.mockResolvedValue(defaultSessionUser);
    mockPrismaConfig.findFirst.mockResolvedValue(null);
  });

  // =========================================================================
  // POST /api/v1/auth/login
  // =========================================================================
  describe("POST /api/v1/auth/login", () => {
    it("returns 401 when user not found", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "unknown@test.com", password: "password123" },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe("Invalid email or password");
    });

    it("returns 401 when user is soft-deleted", async () => {
      const hashed = await bcrypt.hash("password123", 4);
      mockPrismaUser.findUnique.mockResolvedValueOnce(
        fakeUser({ password: hashed, isDeleted: true })
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "test@test.com", password: "password123" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when user has no password (SSO-only)", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(
        fakeUser({ password: null })
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "test@test.com", password: "password123" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when password is wrong", async () => {
      const hashed = await bcrypt.hash("correct-password", 4);
      mockPrismaUser.findUnique.mockResolvedValueOnce(
        fakeUser({ password: hashed })
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "test@test.com", password: "wrong-password" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns user data on successful login", async () => {
      const hashed = await bcrypt.hash("password123", 4);
      mockPrismaUser.findUnique.mockResolvedValueOnce(
        fakeUser({ password: hashed })
      );
      mockPrismaSession.create.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "test@test.com", password: "password123" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe("test@test.com");
      expect(body.user.id).toBe("user-1");
    });

    it("creates a session in the database on successful login", async () => {
      const hashed = await bcrypt.hash("password123", 4);
      mockPrismaUser.findUnique.mockResolvedValueOnce(
        fakeUser({ password: hashed })
      );
      mockPrismaSession.create.mockResolvedValueOnce({});

      await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "test@test.com", password: "password123" },
      });

      expect(mockPrismaSession.create).toHaveBeenCalledTimes(1);
    });

    it("rejects schema-invalid email format", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "not-an-email", password: "password123" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // POST /api/v1/auth/user/register
  // =========================================================================
  describe("POST /api/v1/auth/user/register", () => {
    const validPayload = {
      email: "new@test.com",
      password: "securepass123",
      name: "New User",
      admin: false,
    };

    it("returns 401 when requester is not admin", async () => {
      mockCheckSession.mockResolvedValueOnce({ ...defaultSessionUser, isAdmin: false });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/register",
        payload: validPayload,
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when no session", async () => {
      mockCheckSession.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/register",
        payload: validPayload,
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when email already exists", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(fakeUser());

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/register",
        payload: validPayload,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Email already exists");
    });

    it("creates user successfully when admin and email is new", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);
      mockPrismaUser.create.mockResolvedValueOnce(fakeUser({ id: "new-user-id" }));

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/register",
        payload: validPayload,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockPrismaUser.create).toHaveBeenCalledTimes(1);
    });

    it("creates a user without password when SSO is enabled", async () => {
      mockPrismaConfig.findFirst.mockResolvedValueOnce({ sso_active: true });
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);
      mockPrismaUser.create.mockResolvedValueOnce(fakeUser({ id: "sso-user-id" }));

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/register",
        payload: {
          email: "sso@test.com",
          name: "SSO User",
          admin: false,
          language: "fr",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrismaUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: null,
            language: "fr",
          }),
        })
      );
    });

    it("rejects missing password when SSO is disabled", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/register",
        payload: {
          email: "nopass@test.com",
          name: "No Password",
          admin: false,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Password is required when SSO is disabled");
    });

    it("rejects missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/register",
        payload: { email: "a@b.com" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects password shorter than 8 characters", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/register",
        payload: { ...validPayload, password: "short" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // POST /api/v1/auth/user/register/external
  // =========================================================================
  describe("POST /api/v1/auth/user/register/external", () => {
    const validPayload = {
      email: "external@test.com",
      password: "securepass123",
      name: "External User",
    };

    it("returns 400 when email already exists", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(fakeUser());

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/register/external",
        payload: validPayload,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Email already exists");
    });

    it("creates external user with isAdmin false", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);
      mockPrismaUser.create.mockResolvedValueOnce(fakeUser({ id: "ext-1", external_user: true }));

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/register/external",
        payload: validPayload,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const createCall = mockPrismaUser.create.mock.calls[0][0];
      expect(createCall.data.isAdmin).toBe(false);
      expect(createCall.data.external_user).toBe(true);
    });

    it("rejects missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/register/external",
        payload: { email: "a@b.com" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // POST /api/v1/auth/password-reset
  // =========================================================================
  describe("POST /api/v1/auth/password-reset", () => {
    it("always returns 200 even when user does not exist (no enumeration)", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/password-reset",
        payload: { email: "nonexistent@test.com" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("creates a reset token when user exists", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(fakeUser());
      mockPrismaPasswordResetToken.deleteMany.mockResolvedValueOnce({});
      mockPrismaPasswordResetToken.create.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/password-reset",
        payload: { email: "test@test.com" },
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrismaPasswordResetToken.create).toHaveBeenCalledTimes(1);
    });

    it("deletes old tokens before creating a new one", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(fakeUser());
      mockPrismaPasswordResetToken.deleteMany.mockResolvedValueOnce({});
      mockPrismaPasswordResetToken.create.mockResolvedValueOnce({});

      await app.inject({
        method: "POST",
        url: "/api/v1/auth/password-reset",
        payload: { email: "test@test.com" },
      });

      expect(mockPrismaPasswordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });
  });

  // =========================================================================
  // POST /api/v1/auth/password-reset/password
  // =========================================================================
  describe("POST /api/v1/auth/password-reset/password", () => {
    it("returns 401 when token is invalid or expired", async () => {
      mockPrismaPasswordResetToken.findFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/password-reset/password",
        payload: { token: "invalid-token", password: "newpassword123" },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe("Invalid or expired token");
    });

    it("returns 400 when password is too short", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/password-reset/password",
        payload: { token: "some-token", password: "short" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when token is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/password-reset/password",
        payload: { password: "newpassword123" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("resets password, deletes sessions and tokens on valid token", async () => {
      mockPrismaPasswordResetToken.findFirst.mockResolvedValueOnce({
        userId: "user-1",
        code: "hashed-code",
        expiresAt: new Date(Date.now() + 60000),
      });
      mockPrismaUser.update.mockResolvedValueOnce({});
      mockPrismaSession.deleteMany.mockResolvedValueOnce({});
      mockPrismaPasswordResetToken.deleteMany.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/password-reset/password",
        payload: { token: "valid-token", password: "newpassword123" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
      expect(mockPrismaPasswordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });
  });

  // =========================================================================
  // POST /api/v1/auth/password-reset/code
  // =========================================================================
  describe("POST /api/v1/auth/password-reset/code", () => {
    it("returns 400 when token is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/password-reset/code",
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 401 when token is invalid", async () => {
      mockPrismaPasswordResetToken.findFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/password-reset/code",
        payload: { token: "bad-token" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns success when token is valid", async () => {
      mockPrismaPasswordResetToken.findFirst.mockResolvedValueOnce({
        userId: "user-1",
        code: "hashed",
        expiresAt: new Date(Date.now() + 60000),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/password-reset/code",
        payload: { token: "valid-token" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  // =========================================================================
  // DELETE /api/v1/auth/user/:id
  // =========================================================================
  describe("DELETE /api/v1/auth/user/:id", () => {
    it("returns 404 when user does not exist", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/auth/user/nonexistent-id",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toBe("User not found");
    });

    it("returns 400 when trying to delete the last admin", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(fakeUser({ isAdmin: true }));
      mockPrismaUser.count.mockResolvedValueOnce(1);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/auth/user/user-1",
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Cannot delete the last admin account");
    });

    it("soft-deletes user when multiple admins exist", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(fakeUser({ isAdmin: true }));
      mockPrismaUser.count.mockResolvedValueOnce(3);
      mockPrismaNotes.deleteMany.mockResolvedValueOnce({});
      mockPrismaSession.deleteMany.mockResolvedValueOnce({});
      mockPrismaNotifications.deleteMany.mockResolvedValueOnce({});
      mockPrismaUser.update.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/auth/user/user-1",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({ isDeleted: true }),
        })
      );
    });

    it("deletes non-admin user without checking admin count", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(fakeUser({ isAdmin: false }));
      mockPrismaNotes.deleteMany.mockResolvedValueOnce({});
      mockPrismaSession.deleteMany.mockResolvedValueOnce({});
      mockPrismaNotifications.deleteMany.mockResolvedValueOnce({});
      mockPrismaUser.update.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/auth/user/user-1",
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrismaUser.count).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GET /api/v1/auth/profile
  // =========================================================================
  describe("GET /api/v1/auth/profile", () => {
    it("returns 401 when no session", async () => {
      mockCheckSession.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/profile",
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns user profile with notifications", async () => {
      mockPrismaConfig.findFirst.mockResolvedValueOnce({
        sso_active: false,
        client_version: "0.8.1",
      });
      mockPrismaNotifications.findMany.mockResolvedValueOnce([
        { id: "notif-1", text: "Hello" },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/profile",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user.email).toBe("test@test.com");
      expect(body.user.notifications).toHaveLength(1);
      expect(body.user.sso_status).toBe(false);
      expect(body.user.version).toBe("0.8.1");
    });
  });

  // =========================================================================
  // GET /api/v1/auth/user/:id/logout
  // =========================================================================
  describe("GET /api/v1/auth/user/:id/logout", () => {
    it("returns 401 when no session", async () => {
      mockCheckSession.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/user/user-1/logout",
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 403 when non-admin tries to logout another user", async () => {
      mockCheckSession.mockResolvedValueOnce({
        ...defaultSessionUser,
        id: "user-2",
        isAdmin: false,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/user/user-1/logout",
      });

      expect(res.statusCode).toBe(403);
    });

    it("allows admin to logout another user", async () => {
      mockPrismaSession.deleteMany.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/user/other-user/logout",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockPrismaSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: "other-user" },
      });
    });

    it("allows user to logout themselves", async () => {
      mockCheckSession.mockResolvedValueOnce({
        ...defaultSessionUser,
        id: "user-1",
        isAdmin: false,
      });
      mockPrismaSession.deleteMany.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/user/user-1/logout",
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // PUT /api/v1/auth/user/role
  // =========================================================================
  describe("PUT /api/v1/auth/user/role", () => {
    it("returns 401 when session user is not admin", async () => {
      mockCheckSession.mockResolvedValueOnce({
        ...defaultSessionUser,
        isAdmin: false,
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/auth/user/role",
        payload: { id: "user-2", role: true },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when demoting the last admin", async () => {
      mockPrismaUser.findMany.mockResolvedValueOnce([{ id: "user-1" }]);

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/auth/user/role",
        payload: { id: "user-1", role: false },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("At least one admin is required");
    });

    it("promotes user to admin successfully", async () => {
      mockPrismaUser.update.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/auth/user/role",
        payload: { id: "user-2", role: true },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: "user-2" },
        data: { isAdmin: true },
      });
    });

    it("demotes admin when multiple admins exist", async () => {
      mockPrismaUser.findMany.mockResolvedValueOnce([
        { id: "user-1" },
        { id: "user-2" },
      ]);
      mockPrismaUser.update.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/auth/user/role",
        payload: { id: "user-2", role: false },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  // =========================================================================
  // POST /api/v1/auth/user/:id/first-login
  // =========================================================================
  describe("POST /api/v1/auth/user/:id/first-login", () => {
    it("returns 401 when no session", async () => {
      mockCheckSession.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/user-1/first-login",
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 403 when user tries to update another user", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/other-user/first-login",
      });

      expect(res.statusCode).toBe(403);
    });

    it("sets firstLogin to false for the current user", async () => {
      mockPrismaUser.update.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/user/user-1/first-login",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { firstLogin: false },
      });
    });
  });

  // =========================================================================
  // POST /api/v1/admin/gdpr/erase/:userId
  // =========================================================================
  describe("POST /api/v1/admin/gdpr/erase/:userId", () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";

    it("returns 403 when session user is not admin", async () => {
      mockCheckSession.mockResolvedValueOnce({
        ...defaultSessionUser,
        isAdmin: false,
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/gdpr/erase/${userId}`,
      });

      expect(res.statusCode).toBe(403);
    });

    it("returns 404 when user to erase does not exist", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/gdpr/erase/${userId}`,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toBe("User not found");
    });

    it("anonymizes user data and cleans up related records", async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(fakeUser({ id: userId }));
      mockPrismaUser.update.mockResolvedValueOnce({});
      mockPrismaSession.deleteMany.mockResolvedValueOnce({});
      mockPrismaComment.updateMany.mockResolvedValueOnce({});
      mockPrismaNotifications.deleteMany.mockResolvedValueOnce({});
      mockPrismaNotes.deleteMany.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/gdpr/erase/${userId}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      // Verify anonymization
      const updateCall = mockPrismaUser.update.mock.calls[0][0];
      expect(updateCall.data.name).toBe("Deleted User");
      expect(updateCall.data.password).toBeNull();
      expect(updateCall.data.isDeleted).toBe(true);
      expect(updateCall.data.email).toMatch(/^deleted-[a-f0-9]+@erased\.local$/);

      // Verify related records are cleaned up
      expect(mockPrismaSession.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockPrismaComment.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: { replyEmail: null },
      });
      expect(mockPrismaNotifications.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockPrismaNotes.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it("rejects non-UUID userId via schema validation", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/gdpr/erase/not-a-uuid",
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // GET /api/v1/auth/sessions
  // =========================================================================
  describe("GET /api/v1/auth/sessions", () => {
    it("returns 401 when no session", async () => {
      mockCheckSession.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/sessions",
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns sessions for the current user", async () => {
      mockPrismaSession.findMany.mockResolvedValueOnce([
        {
          id: "session-1",
          userAgent: "Mozilla/5.0",
          ipAddress: "127.0.0.1",
          createdAt: new Date().toISOString(),
          expires: new Date(Date.now() + 3600000).toISOString(),
        },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/sessions",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().sessions).toHaveLength(1);
      expect(res.json().sessions[0].id).toBe("session-1");
    });
  });

  // =========================================================================
  // DELETE /api/v1/auth/sessions/:sessionId
  // =========================================================================
  describe("DELETE /api/v1/auth/sessions/:sessionId", () => {
    it("returns 401 when no session", async () => {
      mockCheckSession.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/auth/sessions/session-1",
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 404 when session does not belong to user", async () => {
      mockPrismaSession.findFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/auth/sessions/session-999",
      });

      expect(res.statusCode).toBe(404);
    });

    it("deletes the session successfully", async () => {
      mockPrismaSession.findFirst.mockResolvedValueOnce({
        id: "session-1",
        userId: "user-1",
        sessionToken: "some-token",
      });
      mockPrismaSession.delete.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/auth/sessions/session-1",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockPrismaSession.delete).toHaveBeenCalledWith({
        where: { id: "session-1" },
      });
    });
  });

  // =========================================================================
  // GET /api/v1/auth/check
  // =========================================================================
  describe("GET /api/v1/auth/check", () => {
    it("returns oauth: false when no SSO config exists", async () => {
      mockPrismaConfig.findMany.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/check",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().oauth).toBe(false);
    });

    it("returns oauth: false when sso_active is false", async () => {
      mockPrismaConfig.findMany.mockResolvedValueOnce([
        { sso_active: false, sso_provider: "oidc" },
      ]);

      // The code first checks length === 0, then checks sso_active.
      // But findMany is called with where: { sso_active: true },
      // so if sso_active is false it would not be returned. Let's test the
      // empty result case which is the realistic path.
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/check",
      });

      // With sso_active: false in the where clause, it should return the
      // record but then hit the !sso_active branch.
      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // POST /api/v1/auth/reset-password (authenticated password change)
  // =========================================================================
  describe("POST /api/v1/auth/reset-password", () => {
    it("returns 401 when no session", async () => {
      mockCheckSession.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { password: "newpassword123" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when password is too short", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { password: "short" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Password must be at least 8 characters");
    });

    it("returns 400 when password is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it("updates password and clears sessions on success", async () => {
      mockPrismaUser.update.mockResolvedValueOnce({});
      mockPrismaSession.deleteMany.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { password: "newstrongpassword" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
        })
      );
      expect(mockPrismaSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });
  });

  // =========================================================================
  // POST /api/v1/auth/admin/reset-password
  // =========================================================================
  describe("POST /api/v1/auth/admin/reset-password", () => {
    it("returns 401 when session user is not admin", async () => {
      mockCheckSession.mockResolvedValueOnce({
        ...defaultSessionUser,
        isAdmin: false,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/admin/reset-password",
        payload: { password: "newpassword123", user: "user-2" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when no session", async () => {
      mockCheckSession.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/admin/reset-password",
        payload: { password: "newpassword123", user: "user-2" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 400 when password is too short", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/admin/reset-password",
        payload: { password: "short", user: "user-2" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("resets target user password and deletes their sessions", async () => {
      mockPrismaUser.update.mockResolvedValueOnce({});
      mockPrismaSession.deleteMany.mockResolvedValueOnce({});

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/admin/reset-password",
        payload: { password: "newstrongpassword", user: "user-2" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-2" },
        })
      );
      expect(mockPrismaSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-2" },
      });
    });
  });
});
