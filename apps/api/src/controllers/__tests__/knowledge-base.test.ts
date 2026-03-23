import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { KnowledgeBaseStatus } from "@prisma/client";

const {
  mockKnowledgeBaseFindMany,
  mockKnowledgeBaseCount,
  mockKnowledgeBaseFindUnique,
  mockKnowledgeBaseFindFirst,
  mockKnowledgeBaseCreate,
  mockKnowledgeBaseUpdate,
  mockKnowledgeBaseDelete,
  mockCheckSession,
} = vi.hoisted(() => ({
  mockKnowledgeBaseFindMany: vi.fn(),
  mockKnowledgeBaseCount: vi.fn(),
  mockKnowledgeBaseFindUnique: vi.fn(),
  mockKnowledgeBaseFindFirst: vi.fn(),
  mockKnowledgeBaseCreate: vi.fn(),
  mockKnowledgeBaseUpdate: vi.fn(),
  mockKnowledgeBaseDelete: vi.fn(),
  mockCheckSession: vi.fn(),
}));

vi.mock("../../prisma", () => ({
  prisma: {
    knowledgeBase: {
      findMany: mockKnowledgeBaseFindMany,
      count: mockKnowledgeBaseCount,
      findUnique: mockKnowledgeBaseFindUnique,
      findFirst: mockKnowledgeBaseFindFirst,
      create: mockKnowledgeBaseCreate,
      update: mockKnowledgeBaseUpdate,
      delete: mockKnowledgeBaseDelete,
    },
  },
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
}));

vi.mock("../../lib/session", () => ({
  checkSession: (...args: unknown[]) => mockCheckSession(...args),
}));

import { knowledgeBaseRoutes } from "../knowledgeBase";

describe("Knowledge base controller", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    knowledgeBaseRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckSession.mockResolvedValue({
      id: "user-1",
      name: "KB Admin",
      email: "admin@example.com",
    });
  });

  it("creates a draft article with a normalized slug", async () => {
    mockKnowledgeBaseCreate.mockImplementationOnce(async ({ data }) => ({
      id: "kb-1",
      createdAt: new Date("2026-03-24T08:00:00.000Z"),
      updatedAt: new Date("2026-03-24T08:00:00.000Z"),
      publishedAt: null,
      public: false,
      ...data,
    }));

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kb/article/create",
      payload: {
        title: "How To Reset Access",
        content: "<p>Step one</p>",
        status: KnowledgeBaseStatus.DRAFT,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(mockKnowledgeBaseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "how-to-reset-access",
          status: KnowledgeBaseStatus.DRAFT,
          public: false,
          publishedAt: null,
        }),
      })
    );
  });

  it("publishes an article and sets a publication date", async () => {
    mockKnowledgeBaseFindUnique.mockResolvedValueOnce({
      id: "kb-1",
      publishedAt: null,
    });
    mockKnowledgeBaseUpdate.mockImplementationOnce(async ({ data }) => ({
      id: "kb-1",
      createdAt: new Date("2026-03-24T08:00:00.000Z"),
      updatedAt: new Date("2026-03-24T08:10:00.000Z"),
      ...data,
    }));

    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/kb/article/550e8400-e29b-41d4-a716-446655440000/update",
      payload: {
        title: "Reset access",
        slug: "reset-access",
        content: "<p>Updated</p>",
        status: KnowledgeBaseStatus.PUBLISHED,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockKnowledgeBaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "reset-access",
          public: true,
          status: KnowledgeBaseStatus.PUBLISHED,
          publishedAt: expect.any(Date),
        }),
      })
    );
  });

  it("loads published articles from the public endpoint", async () => {
    mockKnowledgeBaseFindMany.mockResolvedValueOnce([
      {
        id: "kb-1",
        title: "Public article",
        slug: "public-article",
        excerpt: "Short summary",
        content: "<p>Visible</p>",
        category: "Setup",
        seoTitle: null,
        seoDescription: null,
        publishedAt: new Date("2026-03-24T08:00:00.000Z"),
        updatedAt: new Date("2026-03-24T08:00:00.000Z"),
      },
    ]);
    mockKnowledgeBaseCount.mockResolvedValueOnce(1);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/kb/public/articles",
    });

    expect(res.statusCode).toBe(200);
    expect(mockKnowledgeBaseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: KnowledgeBaseStatus.PUBLISHED,
          public: true,
        }),
      })
    );
    expect(res.json().articles[0].slug).toBe("public-article");
  });

  it("returns a sanitized public article by slug", async () => {
    mockKnowledgeBaseFindFirst.mockResolvedValueOnce({
      id: "kb-1",
      title: "Safe article",
      slug: "safe-article",
      excerpt: "Summary",
      content: '<p>Visible</p><script>alert("x")</script>',
      category: null,
      seoTitle: null,
      seoDescription: null,
      publishedAt: new Date("2026-03-24T08:00:00.000Z"),
      updatedAt: new Date("2026-03-24T08:00:00.000Z"),
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/kb/public/articles/safe-article",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().article.content).toBe("<p>Visible</p>");
  });
});
