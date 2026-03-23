import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import { notFound } from "next/navigation";
import { fetchKnowledgeBaseArticle } from "@/lib/knowledge-base";

export const dynamic = "force-dynamic";

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchKnowledgeBaseArticle(slug);

  if (!article) {
    return {
      title: "Article not found",
    };
  }

  return {
    title: article.seoTitle || article.title,
    description: article.seoDescription || article.excerpt || undefined,
  };
}

export default async function KnowledgeBaseArticlePage({
  params,
}: ArticlePageProps) {
  const { slug } = await params;
  const article = await fetchKnowledgeBaseArticle(slug);

  if (!article) {
    notFound();
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-4 py-2 text-sm text-inkSoft transition hover:border-foreground/30 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all articles
        </Link>

        <article className="mt-6 overflow-hidden rounded-[2rem] border border-border bg-card shadow-article">
          <div className="border-b border-border px-6 py-8 sm:px-10">
            {article.category ? (
              <p className="text-xs uppercase tracking-[0.22em] text-accent">
                {article.category}
              </p>
            ) : null}
            <h1 className="mt-3 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
              {article.title}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-inkSoft">
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                {article.publishedAt
                  ? new Date(article.publishedAt).toLocaleDateString()
                  : new Date(article.updatedAt).toLocaleDateString()}
              </span>
              <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.18em]">
                /articles/{article.slug}
              </span>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-10">
            <div
              className="article-prose prose prose-lg max-w-none prose-headings:scroll-mt-24 prose-img:rounded-2xl prose-img:border prose-img:border-border prose-table:w-full prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-th:border prose-th:border-border prose-th:bg-black/5 prose-th:px-3 prose-th:py-2"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </div>
        </article>
      </div>
    </main>
  );
}
