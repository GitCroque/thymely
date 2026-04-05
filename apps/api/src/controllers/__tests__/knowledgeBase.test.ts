import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

// --- Mocks ---

vi.mock("../../prisma", () => ({
  prisma: {
    knowledgeBase: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

vi.mock("../../lib/session", () => ({
  checkSession: vi.fn().mockResolvedValue({
    id: "user-1",
    email: "test@test.com",
    name: "Test Author",
    isAdmin: true,
  }),
}));

vi.mock("../../lib/roles", () => ({
  requirePermission: () => async () => {},
}));

// --- Imports (after mocks) ---

import { knowledgeBaseRoutes } from "../knowledgeBase";
import { prisma } from "../../prisma";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

const sampleArticle = {
  id: UUID,
  title: "Getting Started",
  slug: "getting-started",
  excerpt: "A quick guide",
  content: "<p>Welcome to Thymely</p>",
  status: "PUBLISHED",
  public: true,
  category: "guides",
  seoTitle: "Getting Started with Thymely",
  seoDescription: "A quick guide to get started",
  publishedAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  createdAt: new Date("2026-01-01"),
};

describe("KnowledgeBase controller", () => {
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
  });

  // ─── GET /api/v1/kb/articles (admin) ───

  describe("GET /api/v1/kb/articles", () => {
    it("returns paginated articles", async () => {
      vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValueOnce([sampleArticle] as any);
      vi.mocked(prisma.knowledgeBase.count).mockResolvedValueOnce(1);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kb/articles",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.articles).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it("returns empty list when no articles", async () => {
      vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.knowledgeBase.count).mockResolvedValueOnce(0);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kb/articles",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.articles).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });
  });

  // ─── GET /api/v1/kb/article/:id ───

  describe("GET /api/v1/kb/article/:id", () => {
    it("returns a single article", async () => {
      vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValueOnce(sampleArticle as any);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kb/article/${UUID}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.article.title).toBe("Getting Started");
    });

    it("returns 404 when article not found", async () => {
      vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kb/article/${UUID}`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── POST /api/v1/kb/article/create ───

  describe("POST /api/v1/kb/article/create", () => {
    it("creates an article and returns 201", async () => {
      vi.mocked(prisma.knowledgeBase.create).mockResolvedValueOnce(sampleArticle as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kb/article/create",
        payload: {
          title: "Getting Started",
          content: "<p>Welcome to Thymely</p>",
          status: "PUBLISHED",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.article).toBeDefined();
    });

    it("returns 409 on duplicate slug (P2002)", async () => {
      vi.mocked(prisma.knowledgeBase.create).mockRejectedValueOnce({ code: "P2002" });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kb/article/create",
        payload: {
          title: "Getting Started",
          content: "<p>Duplicate</p>",
          status: "DRAFT",
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.message).toContain("slug");
    });

    it("rejects missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kb/article/create",
        payload: {
          title: "No content",
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── PUT /api/v1/kb/article/:id/update ───

  describe("PUT /api/v1/kb/article/:id/update", () => {
    it("updates an existing article", async () => {
      vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValueOnce({
        id: UUID,
        publishedAt: new Date(),
      } as any);
      vi.mocked(prisma.knowledgeBase.update).mockResolvedValueOnce({
        ...sampleArticle,
        title: "Updated Title",
      } as any);

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/kb/article/${UUID}/update`,
        payload: {
          title: "Updated Title",
          content: "<p>Updated</p>",
          status: "PUBLISHED",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
    });

    it("returns 404 when article doesn't exist", async () => {
      vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/kb/article/${UUID}/update`,
        payload: {
          title: "New Title",
          content: "<p>Content</p>",
          status: "DRAFT",
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 409 on slug conflict", async () => {
      vi.mocked(prisma.knowledgeBase.findUnique).mockResolvedValueOnce({
        id: UUID,
        publishedAt: null,
      } as any);
      vi.mocked(prisma.knowledgeBase.update).mockRejectedValueOnce({ code: "P2002" });

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/kb/article/${UUID}/update`,
        payload: {
          title: "Conflict Slug",
          slug: "existing-slug",
          content: "<p>Content</p>",
          status: "DRAFT",
        },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  // ─── DELETE /api/v1/kb/article/:id/delete ───

  describe("DELETE /api/v1/kb/article/:id/delete", () => {
    it("deletes an article", async () => {
      vi.mocked(prisma.knowledgeBase.delete).mockResolvedValueOnce({} as any);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/kb/article/${UUID}/delete`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
    });

    it("returns 404 when article doesn't exist (P2025)", async () => {
      vi.mocked(prisma.knowledgeBase.delete).mockRejectedValueOnce({ code: "P2025" });

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/kb/article/${UUID}/delete`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── GET /api/v1/kb/public/articles ───

  describe("GET /api/v1/kb/public/articles", () => {
    it("returns only published public articles", async () => {
      vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValueOnce([sampleArticle] as any);
      vi.mocked(prisma.knowledgeBase.count).mockResolvedValueOnce(1);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kb/public/articles",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.articles).toHaveLength(1);
    });

    it("filters by category", async () => {
      vi.mocked(prisma.knowledgeBase.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.knowledgeBase.count).mockResolvedValueOnce(0);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kb/public/articles?category=guides",
      });

      expect(res.statusCode).toBe(200);
      // Verify the where clause included the category filter
      expect(prisma.knowledgeBase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: "guides",
          }),
        })
      );
    });
  });

  // ─── GET /api/v1/kb/public/articles/:slug ───

  describe("GET /api/v1/kb/public/articles/:slug", () => {
    it("returns a published article by slug", async () => {
      vi.mocked(prisma.knowledgeBase.findFirst).mockResolvedValueOnce(sampleArticle as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kb/public/articles/getting-started",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.article.title).toBe("Getting Started");
    });

    it("returns 404 for non-existent slug", async () => {
      vi.mocked(prisma.knowledgeBase.findFirst).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kb/public/articles/non-existent",
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
