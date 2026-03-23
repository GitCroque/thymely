export type KnowledgeBaseArticleSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type KnowledgeBaseArticleDetail = KnowledgeBaseArticleSummary & {
  content: string;
};

type KnowledgeBaseListResponse = {
  success: boolean;
  articles: KnowledgeBaseArticleSummary[];
};

type KnowledgeBaseArticleResponse = {
  success: boolean;
  article: KnowledgeBaseArticleDetail;
};

const KB_API_ORIGIN = process.env.KNOWLEDGE_BASE_API_URL || "http://127.0.0.1:5003";

export async function fetchKnowledgeBaseArticles(category?: string | null) {
  const url = new URL("/api/v1/kb/public/articles", KB_API_ORIGIN);
  if (category) {
    url.searchParams.set("category", category);
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load knowledge base articles");
  }

  const data = (await response.json()) as KnowledgeBaseListResponse;
  return data.articles;
}

export async function fetchKnowledgeBaseArticle(slug: string) {
  const response = await fetch(
    `${KB_API_ORIGIN}/api/v1/kb/public/articles/${encodeURIComponent(slug)}`,
    {
      cache: "no-store",
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to load knowledge base article");
  }

  const data = (await response.json()) as KnowledgeBaseArticleResponse;
  return data.article;
}
