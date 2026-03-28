import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../prisma", () => ({
  prisma: {
    config: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    email: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    openIdConfig: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    oAuthProvider: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("../../lib/session", () => ({
  checkSession: vi.fn().mockResolvedValue({
    id: "user-1",
    email: "test@test.com",
    name: "Test User",
    isAdmin: true,
  }),
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
  invalidateConfigCache: vi.fn(),
}));

vi.mock("../../lib/hog", () => ({
  track: () => ({ capture: vi.fn(), shutdownAsync: vi.fn() }),
}));

vi.mock("../../lib/audit", () => ({
  auditLog: vi.fn(),
}));

vi.mock("../../lib/security/secrets", () => ({
  encryptSecret: vi.fn().mockResolvedValue("encrypted-value"),
  decryptSecret: vi.fn().mockResolvedValue("decrypted-value"),
}));

vi.mock("../../lib/logger", () => ({
  default: { error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

vi.mock("../../lib/nodemailer/transport", () => ({
  createTransportProvider: vi.fn().mockReturnValue({
    verify: vi.fn((cb: Function) => cb(null, true)),
  }),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    generateAuthUrl: vi.fn().mockReturnValue("https://accounts.google.com/o/oauth2/auth"),
    getToken: vi
      .fn()
      .mockResolvedValue({ tokens: { refresh_token: "rt", access_token: "at", expiry_date: 123 } }),
  })),
}));

// ---------------------------------------------------------------------------
// Import mocked modules for per-test assertions / overrides
// ---------------------------------------------------------------------------

import { prisma } from "../../prisma";
import { checkSession } from "../../lib/session";
import { invalidateConfigCache } from "../../lib/roles";
import { auditLog } from "../../lib/audit";
import { configRoutes } from "../config";

// Typed helpers to access vi.fn() utilities on mocked functions
const mockedConfigFindFirst = prisma.config.findFirst as ReturnType<typeof vi.fn>;
const mockedConfigUpdate = prisma.config.update as ReturnType<typeof vi.fn>;
const mockedEmailFindFirst = prisma.email.findFirst as ReturnType<typeof vi.fn>;
const mockedEmailCreate = prisma.email.create as ReturnType<typeof vi.fn>;
const mockedEmailUpdate = prisma.email.update as ReturnType<typeof vi.fn>;
const mockedEmailDeleteMany = prisma.email.deleteMany as ReturnType<typeof vi.fn>;
const mockedOidcFindFirst = prisma.openIdConfig.findFirst as ReturnType<typeof vi.fn>;
const mockedOidcCreate = prisma.openIdConfig.create as ReturnType<typeof vi.fn>;
const mockedOidcUpdate = prisma.openIdConfig.update as ReturnType<typeof vi.fn>;
const mockedOAuthFindFirst = prisma.oAuthProvider.findFirst as ReturnType<typeof vi.fn>;
const mockedOAuthCreate = prisma.oAuthProvider.create as ReturnType<typeof vi.fn>;
const mockedOAuthDeleteMany = prisma.oAuthProvider.deleteMany as ReturnType<typeof vi.fn>;
const mockedCheckSession = checkSession as ReturnType<typeof vi.fn>;
const mockedInvalidateConfigCache = invalidateConfigCache as ReturnType<typeof vi.fn>;
const mockedAuditLog = auditLog as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFIG_ROW = { id: "cfg-1", sso_active: false, sso_provider: "", roles_active: false };

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Config controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    configRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: config not found (each test overrides as needed)
    mockedConfigFindFirst.mockResolvedValue(null);
    mockedCheckSession.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      name: "Test User",
      isAdmin: true,
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/config/authentication/check
  // -------------------------------------------------------------------------

  describe("GET /api/v1/config/authentication/check", () => {
    it("returns 500 when config is not found", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/config/authentication/check" });
      expect(res.statusCode).toBe(500);
      expect(res.json().success).toBe(false);
    });

    it("returns sso: false when SSO is inactive", async () => {
      mockedConfigFindFirst.mockResolvedValueOnce({ ...CONFIG_ROW, sso_active: false });
      const res = await app.inject({ method: "GET", url: "/api/v1/config/authentication/check" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.sso).toBe(false);
      expect(body.provider).toBeUndefined();
    });

    it("returns sso: true with provider when SSO is active", async () => {
      mockedConfigFindFirst.mockResolvedValueOnce({
        ...CONFIG_ROW,
        sso_active: true,
        sso_provider: "oidc",
      });
      const res = await app.inject({ method: "GET", url: "/api/v1/config/authentication/check" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.sso).toBe(true);
      expect(body.provider).toBe("oidc");
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/v1/config/authentication/oidc/update
  // -------------------------------------------------------------------------

  describe("POST /api/v1/config/authentication/oidc/update", () => {
    const oidcPayload = {
      clientId: "cid",
      clientSecret: "csecret",
      redirectUri: "https://example.com/cb",
      issuer: "https://issuer.example.com",
    };

    it("returns 500 when config is not found", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/config/authentication/oidc/update",
        payload: oidcPayload,
      });
      expect(res.statusCode).toBe(500);
    });

    it("creates a new OIDC provider when none exists", async () => {
      mockedConfigFindFirst.mockResolvedValueOnce(CONFIG_ROW);
      mockedOidcFindFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/config/authentication/oidc/update",
        payload: oidcPayload,
      });

      expect(res.statusCode).toBe(200);
      expect(mockedOidcCreate).toHaveBeenCalledOnce();
      expect(mockedOidcUpdate).not.toHaveBeenCalled();
    });

    it("updates an existing OIDC provider", async () => {
      mockedConfigFindFirst.mockResolvedValueOnce(CONFIG_ROW);
      mockedOidcFindFirst.mockResolvedValueOnce({ id: "oidc-1" });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/config/authentication/oidc/update",
        payload: oidcPayload,
      });

      expect(res.statusCode).toBe(200);
      expect(mockedOidcUpdate).toHaveBeenCalledOnce();
      expect(mockedOidcCreate).not.toHaveBeenCalled();
    });

    it("sets sso_active to true and provider to oidc", async () => {
      mockedConfigFindFirst.mockResolvedValueOnce(CONFIG_ROW);
      mockedOidcFindFirst.mockResolvedValueOnce(null);

      await app.inject({
        method: "POST",
        url: "/api/v1/config/authentication/oidc/update",
        payload: oidcPayload,
      });

      expect(mockedConfigUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { sso_active: true, sso_provider: "oidc" },
        })
      );
    });

    it("calls invalidateConfigCache and auditLog", async () => {
      mockedConfigFindFirst.mockResolvedValueOnce(CONFIG_ROW);
      mockedOidcFindFirst.mockResolvedValueOnce(null);

      await app.inject({
        method: "POST",
        url: "/api/v1/config/authentication/oidc/update",
        payload: oidcPayload,
      });

      expect(mockedInvalidateConfigCache).toHaveBeenCalledOnce();
      expect(mockedAuditLog).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/v1/config/authentication/oauth/update
  // -------------------------------------------------------------------------

  describe("POST /api/v1/config/authentication/oauth/update", () => {
    const oauthPayload = {
      name: "google",
      clientId: "cid",
      clientSecret: "csecret",
      redirectUri: "https://example.com/cb",
    };

    it("returns 500 when config is not found", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/config/authentication/oauth/update",
        payload: oauthPayload,
      });
      expect(res.statusCode).toBe(500);
    });

    it("creates a new OAuth provider when none exists", async () => {
      mockedConfigFindFirst.mockResolvedValueOnce(CONFIG_ROW);
      mockedOAuthFindFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/config/authentication/oauth/update",
        payload: oauthPayload,
      });

      expect(res.statusCode).toBe(200);
      expect(mockedOAuthCreate).toHaveBeenCalledOnce();
    });

    it("updates an existing OAuth provider", async () => {
      mockedConfigFindFirst.mockResolvedValueOnce(CONFIG_ROW);
      mockedOAuthFindFirst.mockResolvedValueOnce({ id: "oauth-1" });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/config/authentication/oauth/update",
        payload: oauthPayload,
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.oAuthProvider.update).toHaveBeenCalledOnce();
      expect(mockedOAuthCreate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/v1/config/authentication
  // -------------------------------------------------------------------------

  describe("DELETE /api/v1/config/authentication", () => {
    it("returns 500 when config is not found", async () => {
      const res = await app.inject({ method: "DELETE", url: "/api/v1/config/authentication" });
      expect(res.statusCode).toBe(500);
    });

    it("disables SSO and deletes OAuth providers", async () => {
      mockedConfigFindFirst.mockResolvedValueOnce(CONFIG_ROW);

      const res = await app.inject({ method: "DELETE", url: "/api/v1/config/authentication" });

      expect(res.statusCode).toBe(200);
      expect(mockedConfigUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { sso_active: false, sso_provider: "" },
        })
      );
      expect(mockedOAuthDeleteMany).toHaveBeenCalledOnce();
      expect(mockedInvalidateConfigCache).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/config/email
  // -------------------------------------------------------------------------

  describe("GET /api/v1/config/email", () => {
    it("returns active: false when no email config exists", async () => {
      mockedEmailFindFirst.mockResolvedValueOnce(null);

      const res = await app.inject({ method: "GET", url: "/api/v1/config/email" });

      expect(res.statusCode).toBe(200);
      expect(res.json().active).toBe(false);
    });

    it("verifies transport and returns email config when active", async () => {
      mockedEmailFindFirst.mockResolvedValueOnce({
        active: true,
        host: "smtp.example.com",
        port: "587",
        reply: "noreply@example.com",
        user: "user@example.com",
      });

      const res = await app.inject({ method: "GET", url: "/api/v1/config/email" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.active).toBe(true);
      expect(body.email.host).toBe("smtp.example.com");
      expect(body.verification).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/v1/config/email
  // -------------------------------------------------------------------------

  describe("PUT /api/v1/config/email", () => {
    const emailPayload = {
      host: "smtp.example.com",
      active: true,
      port: "587",
      reply: "noreply@example.com",
      username: "user@example.com",
      password: "secret",
      serviceType: "other",
    };

    it("creates new email config when none exists", async () => {
      mockedEmailFindFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/config/email",
        payload: emailPayload,
      });

      expect(res.statusCode).toBe(200);
      expect(mockedEmailCreate).toHaveBeenCalledOnce();
      expect(mockedEmailUpdate).not.toHaveBeenCalled();
    });

    it("updates existing email config", async () => {
      mockedEmailFindFirst.mockResolvedValueOnce({ id: "email-1" });

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/config/email",
        payload: emailPayload,
      });

      expect(res.statusCode).toBe(200);
      expect(mockedEmailUpdate).toHaveBeenCalledOnce();
    });

    it("encrypts the password via encryptSecret", async () => {
      mockedEmailFindFirst.mockResolvedValueOnce(null);

      await app.inject({
        method: "PUT",
        url: "/api/v1/config/email",
        payload: emailPayload,
      });

      // The created record should contain the encrypted password
      expect(mockedEmailCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pass: "encrypted-value" }),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/v1/config/email
  // -------------------------------------------------------------------------

  describe("DELETE /api/v1/config/email", () => {
    it("deletes all email configuration", async () => {
      const res = await app.inject({ method: "DELETE", url: "/api/v1/config/email" });

      expect(res.statusCode).toBe(200);
      expect(mockedEmailDeleteMany).toHaveBeenCalledOnce();
      expect(res.json().success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/v1/config/toggle-roles
  // -------------------------------------------------------------------------

  describe("PATCH /api/v1/config/toggle-roles", () => {
    it("updates roles_active and invalidates cache for admin", async () => {
      mockedConfigFindFirst.mockResolvedValueOnce(CONFIG_ROW);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/config/toggle-roles",
        payload: { isActive: true },
      });

      expect(res.statusCode).toBe(200);
      expect(mockedConfigUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { roles_active: true },
        })
      );
      expect(mockedInvalidateConfigCache).toHaveBeenCalledOnce();
    });

    it("returns 403 when user is not admin", async () => {
      mockedCheckSession.mockResolvedValueOnce({
        id: "user-2",
        email: "nonadmin@test.com",
        name: "Regular User",
        isAdmin: false,
      });
      // Do NOT mock configFindFirst here: the handler returns 403 before
      // reaching ensureConfig, so the mock would remain unconsumed and
      // leak into the next test.

      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/config/toggle-roles",
        payload: { isActive: true },
      });

      expect(res.statusCode).toBe(403);
      expect(mockedConfigUpdate).not.toHaveBeenCalled();
    });

    it("returns 500 when config is not found", async () => {
      // config.findFirst returns null by default (from beforeEach)
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/config/toggle-roles",
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(500);
    });
  });
});
