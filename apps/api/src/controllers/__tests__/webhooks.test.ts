import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const {
  mockWebhookCreate,
  mockWebhookFindMany,
  mockWebhookDelete,
  mockCheckSession,
  mockEncryptSecret,
  mockAssertSafeWebhookUrl,
  mockTrackCapture,
  mockTrackShutdown,
} = vi.hoisted(() => ({
  mockWebhookCreate: vi.fn(),
  mockWebhookFindMany: vi.fn(),
  mockWebhookDelete: vi.fn(),
  mockCheckSession: vi.fn(),
  mockEncryptSecret: vi.fn(),
  mockAssertSafeWebhookUrl: vi.fn(),
  mockTrackCapture: vi.fn(),
  mockTrackShutdown: vi.fn(),
}));

vi.mock("../../prisma", () => ({
  prisma: {
    webhooks: {
      create: mockWebhookCreate,
      findMany: mockWebhookFindMany,
      delete: mockWebhookDelete,
    },
  },
}));

vi.mock("../../lib/session", () => ({
  checkSession: (...args: unknown[]) => mockCheckSession(...args),
}));

vi.mock("../../lib/security/secrets", () => ({
  encryptSecret: (...args: unknown[]) => mockEncryptSecret(...args),
}));

vi.mock("../../lib/security/webhook-url", () => ({
  assertSafeWebhookUrl: (...args: unknown[]) => mockAssertSafeWebhookUrl(...args),
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

import { webhookRoutes } from "../webhooks";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const WEBHOOK_ID = "22222222-2222-4222-8222-222222222222";

describe("Webhook controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    webhookRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckSession.mockResolvedValue({ id: USER_ID });
    mockEncryptSecret.mockResolvedValue("enc:secret");
    mockWebhookCreate.mockResolvedValue({});
    mockWebhookFindMany.mockResolvedValue([
      {
        id: WEBHOOK_ID,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        name: "Discord",
        url: "https://example.com/webhook",
        type: "ticket_created",
        active: true,
      },
    ]);
    mockWebhookDelete.mockResolvedValue({});
  });

  it("refuse une URL de webhook invalide", async () => {
    mockAssertSafeWebhookUrl.mockRejectedValueOnce(new Error("Invalid webhook URL"));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/webhook/create",
      payload: {
        name: "Discord",
        url: "http://unsafe.local/webhook",
        type: "ticket_created",
        active: true,
        secret: "secret",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      success: false,
      message: "Invalid webhook URL",
    });
  });

  it("cree un webhook valide", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/webhook/create",
      payload: {
        name: "Discord",
        url: "https://example.com/webhook",
        type: "ticket_created",
        active: true,
        secret: "secret",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      message: "Hook created!",
    });
    expect(mockWebhookCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdBy: USER_ID,
          secret: "enc:secret",
        }),
      })
    );
  });

  it("liste les webhooks", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/webhooks/all",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      webhooks: [
        expect.objectContaining({
          id: WEBHOOK_ID,
          name: "Discord",
        }),
      ],
    });
  });

  it("supprime un webhook", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/webhook/${WEBHOOK_ID}/delete`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(mockWebhookDelete).toHaveBeenCalledWith({
      where: { id: WEBHOOK_ID },
    });
  });
});
