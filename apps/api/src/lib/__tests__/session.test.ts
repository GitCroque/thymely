import { describe, it, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";

// --- Mocks (hoisted to avoid reference errors) ---

const mockPrismaSession = vi.hoisted(() => ({
  findUnique: vi.fn(),
  deleteMany: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../../prisma", () => ({
  prisma: {
    session: mockPrismaSession,
  },
}));

// --- Imports (after mocks) ---

import { checkSession } from "../session";

const SECRET_B64 = Buffer.from("a".repeat(32)).toString("base64");

function signToken(payload: object = { sub: "user-1" }): string {
  return jwt.sign(payload, Buffer.from(SECRET_B64, "base64"));
}

function expiredToken(): string {
  return jwt.sign({ sub: "user-1" }, Buffer.from(SECRET_B64, "base64"), { expiresIn: -10 });
}

function fakeRequest(overrides: {
  authorization?: string;
  cookies?: Record<string, string>;
  userAgent?: string;
  ip?: string;
} = {}) {
  return {
    headers: {
      authorization: overrides.authorization,
      "user-agent": overrides.userAgent ?? "TestAgent/1.0",
    },
    cookies: overrides.cookies,
    ip: overrides.ip ?? "127.0.0.1",
  } as any;
}

const validUser = {
  id: "user-1",
  email: "test@test.com",
  name: "Test",
  isAdmin: false,
};

describe("checkSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SECRET = SECRET_B64;
  });

  it("returns null when no token present", async () => {
    const result = await checkSession(fakeRequest());
    expect(result).toBeNull();
  });

  it("returns null and cleans up for an expired JWT", async () => {
    const token = expiredToken();
    mockPrismaSession.deleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await checkSession(
      fakeRequest({ authorization: `Bearer ${token}` })
    );

    expect(result).toBeNull();
    expect(mockPrismaSession.deleteMany).toHaveBeenCalledWith({
      where: { sessionToken: token },
    });
  });

  it("returns null when session not found in DB", async () => {
    const token = signToken();
    mockPrismaSession.findUnique.mockResolvedValueOnce(null);

    const result = await checkSession(
      fakeRequest({ authorization: `Bearer ${token}` })
    );

    expect(result).toBeNull();
  });

  it("returns null and deletes DB session when expired", async () => {
    const token = signToken();
    const pastDate = new Date(Date.now() - 60000);

    mockPrismaSession.findUnique.mockResolvedValueOnce({
      id: "session-1",
      sessionToken: token,
      expires: pastDate,
      userAgent: "TestAgent/1.0",
      ipAddress: "127.0.0.1",
      user: validUser,
    });
    mockPrismaSession.delete.mockResolvedValueOnce({});

    const result = await checkSession(
      fakeRequest({ authorization: `Bearer ${token}` })
    );

    expect(result).toBeNull();
    expect(mockPrismaSession.delete).toHaveBeenCalledWith({
      where: { id: "session-1" },
    });
  });

  it("returns null when user-agent doesn't match", async () => {
    const token = signToken();
    const futureDate = new Date(Date.now() + 3600000);

    mockPrismaSession.findUnique.mockResolvedValueOnce({
      id: "session-1",
      sessionToken: token,
      expires: futureDate,
      userAgent: "DifferentBrowser/2.0",
      ipAddress: "127.0.0.1",
      user: validUser,
    });
    mockPrismaSession.delete.mockResolvedValueOnce({});

    const result = await checkSession(
      fakeRequest({ authorization: `Bearer ${token}` })
    );

    expect(result).toBeNull();
    expect(mockPrismaSession.delete).toHaveBeenCalledWith({
      where: { id: "session-1" },
    });
  });

  it("allows IP mismatch when SESSION_BIND_IP is not set", async () => {
    delete process.env.SESSION_BIND_IP;
    const token = signToken();
    const futureDate = new Date(Date.now() + 3600000);

    mockPrismaSession.findUnique.mockResolvedValueOnce({
      id: "session-1",
      sessionToken: token,
      expires: futureDate,
      userAgent: "TestAgent/1.0",
      ipAddress: "10.0.0.99",
      user: validUser,
    });

    const result = await checkSession(
      fakeRequest({ authorization: `Bearer ${token}` })
    );

    // IP mismatch is allowed by default — session is valid
    expect(result).toEqual(validUser);
  });

  it("returns null when IP doesn't match and SESSION_BIND_IP is true", async () => {
    process.env.SESSION_BIND_IP = "true";
    const token = signToken();
    const futureDate = new Date(Date.now() + 3600000);

    mockPrismaSession.findUnique.mockResolvedValueOnce({
      id: "session-1",
      sessionToken: token,
      expires: futureDate,
      userAgent: "TestAgent/1.0",
      ipAddress: "10.0.0.99",
      user: validUser,
    });
    mockPrismaSession.delete.mockResolvedValueOnce({});

    const result = await checkSession(
      fakeRequest({ authorization: `Bearer ${token}` })
    );

    expect(result).toBeNull();
    delete process.env.SESSION_BIND_IP;
  });

  it("returns user when everything matches", async () => {
    const token = signToken();
    const futureDate = new Date(Date.now() + 3600000);

    mockPrismaSession.findUnique.mockResolvedValueOnce({
      id: "session-1",
      sessionToken: token,
      expires: futureDate,
      userAgent: "TestAgent/1.0",
      ipAddress: "127.0.0.1",
      user: validUser,
    });

    const result = await checkSession(
      fakeRequest({ authorization: `Bearer ${token}` })
    );

    expect(result).toEqual(validUser);
  });

  it("accepts session from cookie", async () => {
    const token = signToken();
    const futureDate = new Date(Date.now() + 3600000);

    mockPrismaSession.findUnique.mockResolvedValueOnce({
      id: "session-1",
      sessionToken: token,
      expires: futureDate,
      userAgent: "TestAgent/1.0",
      ipAddress: "127.0.0.1",
      user: validUser,
    });

    const result = await checkSession(
      fakeRequest({ cookies: { session: token } })
    );

    expect(result).toEqual(validUser);
  });

  it("caches result per request (does not query DB twice)", async () => {
    const token = signToken();
    const futureDate = new Date(Date.now() + 3600000);

    mockPrismaSession.findUnique.mockResolvedValueOnce({
      id: "session-1",
      sessionToken: token,
      expires: futureDate,
      userAgent: "TestAgent/1.0",
      ipAddress: "127.0.0.1",
      user: validUser,
    });

    const req = fakeRequest({ authorization: `Bearer ${token}` });
    const result1 = await checkSession(req);
    const result2 = await checkSession(req);

    expect(result1).toEqual(validUser);
    expect(result2).toEqual(validUser);
    // Only called once due to per-request cache
    expect(mockPrismaSession.findUnique).toHaveBeenCalledTimes(1);
  });
});
