import Link from "next/link";
import { ArrowRight, BookOpenText, LifeBuoy, Sparkles } from "lucide-react";
import { fetchKnowledgeBaseArticles } from "@/lib/knowledge-base";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    category?: string;
  }>;
};

export default async function KnowledgeBaseHome({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const currentCategory = resolvedSearchParams?.category || null;
  const allArticles = await fetchKnowledgeBaseArticles();
  const categories = Array.from(
    new Set(
      allArticles
        .map((article) => article.category)
        .filter((category): category is string => Boolean(category))
    )
  );
  const articles = currentCategory
    ? allArticles.filter((article) => article.category === currentCategory)
    : allArticles;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-8 shadow-article backdrop-blur md:px-10 md:py-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_320px] lg:items-end">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-inkSoft">
                <Sparkles className="h-3.5 w-3.5" />
                Integrated product help
              </div>
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.3em] text-inkSoft">
                  Thymely Knowledge Base
                </p>
                <h1 className="max-w-3xl font-serif text-4xl leading-tight text-foreground sm:text-5xl">
                  Answers designed for customers, not hidden in product docs.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-inkSoft sm:text-lg">
                  Browse public help articles, setup guides, and operational
                  workflows maintained directly from the Thymely admin.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.5rem] border border-border bg-white/70 p-5">
                <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                  <BookOpenText className="h-4 w-4 text-accent" />
                  Public article count
                </div>
                <p className="mt-4 font-serif text-5xl text-foreground">
                  {articles.length}
                </p>
                <p className="mt-2 text-sm text-inkSoft">
                  Published guides available right now.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border bg-[#12211c] p-5 text-[#f7f1e7]">
                <div className="flex items-center gap-3 text-sm font-semibold">
                  <LifeBuoy className="h-4 w-4 text-[#8ce1bf]" />
                  Support-first surface
                </div>
                <p className="mt-3 text-sm leading-6 text-[#d8d1c5]">
                  This site is powered by API-published articles, not a static
                  documentation export.
                </p>
              </div>
            </div>
          </div>
        </section>

        {categories.length > 0 ? (
          <section className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className={`rounded-full border px-4 py-2 text-sm transition ${
                !currentCategory
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-white/70 text-foreground hover:border-foreground/30"
              }`}
            >
              All topics
            </Link>
            {categories.map((category) => (
              <Link
                key={category}
                href={`/?category=${encodeURIComponent(category)}`}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  currentCategory === category
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-white/70 text-foreground hover:border-foreground/30"
                }`}
              >
                {category}
              </Link>
            ))}
          </section>
        ) : null}

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {articles.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-white/60 p-8 text-center text-inkSoft md:col-span-2 xl:col-span-3">
              No published articles yet.
            </div>
          ) : (
            articles.map((article) => (
              <Link
                key={article.id}
                href={`/articles/${article.slug}`}
                className="group rounded-[1.5rem] border border-border bg-card p-6 shadow-article transition duration-200 hover:-translate-y-1 hover:border-foreground/25"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    {article.category ? (
                      <span className="inline-flex rounded-full bg-accentSoft px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                        {article.category}
                      </span>
                    ) : null}
                    <h2 className="font-serif text-2xl leading-tight text-foreground">
                      {article.title}
                    </h2>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-inkSoft transition group-hover:translate-x-1 group-hover:text-accent" />
                </div>
                <p className="mt-4 line-clamp-4 text-sm leading-6 text-inkSoft">
                  {article.excerpt || article.seoDescription || "Open the article"}
                </p>
                <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-inkSoft">
                  <span>
                    {article.publishedAt
                      ? new Date(article.publishedAt).toLocaleDateString()
                      : "Draft"}
                  </span>
                  <span>/articles/{article.slug}</span>
                </div>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
