import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const {
  mockEmailQueueCreate,
  mockEmailQueueFindFirst,
  mockEmailQueueUpdate,
  mockEmailQueueFindMany,
  mockEmailQueueDelete,
  mockEncryptSecret,
  mockDecryptSecret,
  mockTrackCapture,
  mockTrackShutdown,
  mockGenerateAuthUrl,
  mockGetToken,
} = vi.hoisted(() => ({
  mockEmailQueueCreate: vi.fn(),
  mockEmailQueueFindFirst: vi.fn(),
  mockEmailQueueUpdate: vi.fn(),
  mockEmailQueueFindMany: vi.fn(),
  mockEmailQueueDelete: vi.fn(),
  mockEncryptSecret: vi.fn(),
  mockDecryptSecret: vi.fn(),
  mockTrackCapture: vi.fn(),
  mockTrackShutdown: vi.fn(),
  mockGenerateAuthUrl: vi.fn(),
  mockGetToken: vi.fn(),
}));

vi.mock("../../prisma", () => ({
  prisma: {
    emailQueue: {
      create: mockEmailQueueCreate,
      findFirst: mockEmailQueueFindFirst,
      update: mockEmailQueueUpdate,
      findMany: mockEmailQueueFindMany,
      delete: mockEmailQueueDelete,
    },
  },
}));

vi.mock("../../lib/security/secrets", () => ({
  encryptSecret: (...args: unknown[]) => mockEncryptSecret(...args),
  decryptSecret: (...args: unknown[]) => mockDecryptSecret(...args),
}));

vi.mock("../../lib/hog", () => ({
  track: () => ({
    capture: mockTrackCapture,
    shutdownAsync: mockTrackShutdown,
  }),
}));

vi.mock("../../lib/logger", () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(function MockOAuth2Client() {
    return {
      generateAuthUrl: mockGenerateAuthUrl,
      getToken: mockGetToken,
    };
  }),
}));

import { emailQueueRoutes } from "../queue";

const MAILBOX_ID = "11111111-1111-4111-8111-111111111111";

describe("Email queue controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    emailQueueRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockEncryptSecret.mockImplementation(async (value: string | undefined) => `enc:${value ?? ""}`);
    mockDecryptSecret.mockResolvedValue("client-secret");
    mockEmailQueueCreate.mockResolvedValue({ id: MAILBOX_ID });
    mockGenerateAuthUrl.mockReturnValue("https://accounts.google.test/auth");
    mockGetToken.mockResolvedValue({
      tokens: {
        refresh_token: "refresh-token",
        access_token: "access-token",
        expiry_date: 1234,
      },
    });
    mockEmailQueueFindFirst.mockResolvedValue({
      id: MAILBOX_ID,
      clientId: "client-id",
      clientSecret: "encrypted-client-secret",
      redirectUri: "https://example.com/callback",
    });
    mockEmailQueueFindMany.mockResolvedValue([
      {
        id: MAILBOX_ID,
        name: "Primary inbox",
        serviceType: "gmail",
        active: true,
        teams: [],
        username: "help@example.com",
        hostname: "imap.gmail.com",
        tls: true,
        clientId: "client-id",
        redirectUri: "https://example.com/callback",
      },
    ]);
    mockEmailQueueDelete.mockResolvedValue({});
    mockEmailQueueUpdate.mockResolvedValue({});
  });

  it("cree une queue Gmail et retourne l'URL d'autorisation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/email-queue/create",
      payload: {
        name: "Primary inbox",
        username: "help@example.com",
        password: "smtp-password",
        hostname: "imap.gmail.com",
        tls: true,
        serviceType: "gmail",
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://example.com/callback",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      message: "Gmail imap provider created!",
      authorizeUrl: "https://accounts.google.test/auth",
    });
    expect(mockEmailQueueCreate).toHaveBeenCalledOnce();
  });

  it("finalise le callback OAuth Gmail", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/email-queue/oauth/gmail?code=test-code&mailboxId=${MAILBOX_ID}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      message: "Mailbox updated!",
    });
    expect(mockEmailQueueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MAILBOX_ID },
        data: expect.objectContaining({
          serviceType: "gmail",
        }),
      })
    );
  });

  it("liste les queues configurees", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/email-queues/all",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      queues: [
        expect.objectContaining({
          id: MAILBOX_ID,
          name: "Primary inbox",
        }),
      ],
    });
  });

  it("supprime une queue", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/email-queue/delete",
      payload: {
        id: MAILBOX_ID,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(mockEmailQueueDelete).toHaveBeenCalledWith({
      where: { id: MAILBOX_ID },
    });
  });
});
