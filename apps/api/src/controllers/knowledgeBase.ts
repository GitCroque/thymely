import { KnowledgeBaseStatus } from "@prisma/client";
import { FastifyInstance } from "fastify";
import {
  buildKnowledgeBaseExcerpt,
  buildKnowledgeBaseSeoDescription,
  buildKnowledgeBaseSeoTitle,
  normalizeKnowledgeBaseSlug,
  resolveKnowledgeBasePublishedAt,
  sanitizeKnowledgeBasePublicContent,
  sanitizeKnowledgeBaseText,
} from "../lib/knowledge-base";
import { parsePagination } from "../lib/pagination";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

type KnowledgeBaseMutationBody = {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content: string;
  status: KnowledgeBaseStatus;
  category?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

function normalizeOptionalField(value?: string | null) {
  const cleaned = sanitizeKnowledgeBaseText(value);
  return cleaned || null;
}

function getNormalizedSlug(title: string, slug?: string) {
  return normalizeKnowledgeBaseSlug(slug || title);
}

function getPublicArticleSelect() {
  return {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    content: true,
    category: true,
    seoTitle: true,
    seoDescription: true,
    publishedAt: true,
    updatedAt: true,
  } as const;
}

function getAdminArticleSelect() {
  return {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    content: true,
    status: true,
    public: true,
    category: true,
    seoTitle: true,
    seoDescription: true,
    publishedAt: true,
    updatedAt: true,
    createdAt: true,
  } as const;
}

function formatPublicArticle(
  article: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    category: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    publishedAt: Date | null;
    updatedAt: Date;
  }
) {
  return {
    ...article,
    excerpt: article.excerpt || buildKnowledgeBaseExcerpt(null, article.content),
    seoTitle: article.seoTitle || article.title,
    seoDescription:
      article.seoDescription ||
      buildKnowledgeBaseSeoDescription(null, article.excerpt, article.content),
    content: sanitizeKnowledgeBasePublicContent(article.content),
  };
}

export function knowledgeBaseRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
    };
  }>(
    "/api/v1/kb/articles",
    {
      preHandler: requirePermission(["kb::read"]),
    },
    async (request, reply) => {
      const { skip, take, page, limit } = parsePagination(request.query);
      const [articles, total] = await Promise.all([
        prisma.knowledgeBase.findMany({
          skip,
          take,
          orderBy: [{ updatedAt: "desc" }],
          select: getAdminArticleSelect(),
        }),
        prisma.knowledgeBase.count(),
      ]);

      return reply.status(200).send({
        success: true,
        articles,
        pagination: { page, limit, total },
      });
    }
  );

  fastify.get<{
    Params: {
      id: string;
    };
  }>(
    "/api/v1/kb/article/:id",
    {
      preHandler: requirePermission(["kb::read"]),
    },
    async (request, reply) => {
      const article = await prisma.knowledgeBase.findUnique({
        where: {
          id: request.params.id,
        },
        select: getAdminArticleSelect(),
      });

      if (!article) {
        return reply.status(404).send({
          success: false,
          message: "Knowledge base article not found",
        });
      }

      return reply.status(200).send({
        success: true,
        article,
      });
    }
  );

  fastify.post<{
    Body: KnowledgeBaseMutationBody;
  }>(
    "/api/v1/kb/article/create",
    {
      preHandler: requirePermission(["kb::create"]),
      schema: {
        body: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 1, maxLength: 180 },
            slug: { type: "string", minLength: 1, maxLength: 180 },
            excerpt: { type: "string", maxLength: 320 },
            content: { type: "string", maxLength: 200000 },
            status: { type: "string", enum: Object.values(KnowledgeBaseStatus) },
            category: { type: "string", maxLength: 80 },
            seoTitle: { type: "string", maxLength: 180 },
            seoDescription: { type: "string", maxLength: 220 },
          },
          required: ["title", "content", "status"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const session = await checkSession(request);
      const normalizedSlug = getNormalizedSlug(
        request.body.title,
        request.body.slug
      );

      if (!normalizedSlug) {
        return reply.status(400).send({
          success: false,
          message: "A valid slug is required",
        });
      }

      const nextStatus = request.body.status;
      const publishedAt = resolveKnowledgeBasePublishedAt(nextStatus);

      try {
        const article = await prisma.knowledgeBase.create({
          data: {
            title: request.body.title.trim(),
            slug: normalizedSlug,
            excerpt: buildKnowledgeBaseExcerpt(
              request.body.excerpt,
              request.body.content
            ),
            content: request.body.content,
            author: session?.name?.trim() || session?.email || "Unknown",
            tags: [],
            public: nextStatus === KnowledgeBaseStatus.PUBLISHED,
            status: nextStatus,
            publishedAt,
            category: normalizeOptionalField(request.body.category),
            seoTitle: buildKnowledgeBaseSeoTitle(
              request.body.seoTitle,
              request.body.title
            ),
            seoDescription: buildKnowledgeBaseSeoDescription(
              request.body.seoDescription,
              request.body.excerpt,
              request.body.content
            ),
          },
          select: getAdminArticleSelect(),
        });

        return reply.status(201).send({
          success: true,
          article,
        });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
          return reply.status(409).send({
            success: false,
            message: "This slug is already in use",
          });
        }

        throw error;
      }
    }
  );

  fastify.put<{
    Params: {
      id: string;
    };
    Body: KnowledgeBaseMutationBody;
  }>(
    "/api/v1/kb/article/:id/update",
    {
      preHandler: requirePermission(["kb::update"]),
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
          additionalProperties: false,
        },
        body: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 1, maxLength: 180 },
            slug: { type: "string", minLength: 1, maxLength: 180 },
            excerpt: { type: "string", maxLength: 320 },
            content: { type: "string", maxLength: 200000 },
            status: { type: "string", enum: Object.values(KnowledgeBaseStatus) },
            category: { type: "string", maxLength: 80 },
            seoTitle: { type: "string", maxLength: 180 },
            seoDescription: { type: "string", maxLength: 220 },
          },
          required: ["title", "content", "status"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const existingArticle = await prisma.knowledgeBase.findUnique({
        where: {
          id: request.params.id,
        },
        select: {
          id: true,
          publishedAt: true,
        },
      });

      if (!existingArticle) {
        return reply.status(404).send({
          success: false,
          message: "Knowledge base article not found",
        });
      }

      const normalizedSlug = getNormalizedSlug(
        request.body.title,
        request.body.slug
      );

      if (!normalizedSlug) {
        return reply.status(400).send({
          success: false,
          message: "A valid slug is required",
        });
      }

      const nextStatus = request.body.status;

      try {
        const article = await prisma.knowledgeBase.update({
          where: {
            id: request.params.id,
          },
          data: {
            title: request.body.title.trim(),
            slug: normalizedSlug,
            excerpt: buildKnowledgeBaseExcerpt(
              request.body.excerpt,
              request.body.content
            ),
            content: request.body.content,
            public: nextStatus === KnowledgeBaseStatus.PUBLISHED,
            status: nextStatus,
            publishedAt: resolveKnowledgeBasePublishedAt(
              nextStatus,
              existingArticle.publishedAt
            ),
            category: normalizeOptionalField(request.body.category),
            seoTitle: buildKnowledgeBaseSeoTitle(
              request.body.seoTitle,
              request.body.title
            ),
            seoDescription: buildKnowledgeBaseSeoDescription(
              request.body.seoDescription,
              request.body.excerpt,
              request.body.content
            ),
            updatedAt: new Date(),
          },
          select: getAdminArticleSelect(),
        });

        return reply.status(200).send({
          success: true,
          article,
        });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
          return reply.status(409).send({
            success: false,
            message: "This slug is already in use",
          });
        }

        throw error;
      }
    }
  );

  fastify.delete<{
    Params: {
      id: string;
    };
  }>(
    "/api/v1/kb/article/:id/delete",
    {
      preHandler: requirePermission(["kb::delete"]),
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        await prisma.knowledgeBase.delete({
          where: {
            id: request.params.id,
          },
        });

        return reply.status(200).send({
          success: true,
        });
      } catch (error) {
        if ((error as { code?: string }).code === "P2025") {
          return reply.status(404).send({
            success: false,
            message: "Knowledge base article not found",
          });
        }

        throw error;
      }
    }
  );

  fastify.get<{
    Querystring: {
      category?: string;
      page?: string;
      limit?: string;
    };
  }>(
    "/api/v1/kb/public/articles",
    async (request, reply) => {
      const { skip, take, page, limit } = parsePagination(request.query);
      const category = normalizeOptionalField(request.query.category);
      const now = new Date();

      const where = {
        status: KnowledgeBaseStatus.PUBLISHED,
        public: true,
        publishedAt: {
          lte: now,
        },
        ...(category ? { category } : {}),
      };

      const [articles, total] = await Promise.all([
        prisma.knowledgeBase.findMany({
          where,
          skip,
          take,
          orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
          select: getPublicArticleSelect(),
        }),
        prisma.knowledgeBase.count({ where }),
      ]);

      return reply.status(200).send({
        success: true,
        articles: articles.map((article) => ({
          id: article.id,
          title: article.title,
          slug: article.slug,
          excerpt:
            article.excerpt || buildKnowledgeBaseExcerpt(null, article.content),
          category: article.category,
          seoTitle: article.seoTitle || article.title,
          seoDescription:
            article.seoDescription ||
            buildKnowledgeBaseSeoDescription(null, article.excerpt, article.content),
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
        })),
        pagination: { page, limit, total },
      });
    }
  );

  fastify.get<{
    Params: {
      slug: string;
    };
  }>(
    "/api/v1/kb/public/articles/:slug",
    async (request, reply) => {
      const article = await prisma.knowledgeBase.findFirst({
        where: {
          slug: request.params.slug,
          status: KnowledgeBaseStatus.PUBLISHED,
          public: true,
          publishedAt: {
            lte: new Date(),
          },
        },
        select: getPublicArticleSelect(),
      });

      if (!article) {
        return reply.status(404).send({
          success: false,
          message: "Knowledge base article not found",
        });
      }

      return reply.status(200).send({
        success: true,
        article: formatPublicArticle(article),
      });
    }
  );
}
