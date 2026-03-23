import { toast } from "@/shadcn/hooks/use-toast";
import { hasAccess } from "@/shadcn/lib/hasAccess";
import { Button } from "@/shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { Input } from "@/shadcn/ui/input";
import { Label } from "@/shadcn/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/ui/select";
import { getCookie } from "cookies-next";
import { useEffect, useMemo, useState } from "react";

type KnowledgeBaseStatus = "DRAFT" | "PUBLISHED";

type KnowledgeBaseArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  status: KnowledgeBaseStatus;
  category: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
  createdAt?: string;
};

type ArticlesResponse = {
  success?: boolean;
  message?: string;
  articles?: KnowledgeBaseArticle[];
};

type ArticleResponse = {
  success?: boolean;
  message?: string;
  article?: KnowledgeBaseArticle;
};

type MutationResponse = {
  success?: boolean;
  message?: string;
  article?: KnowledgeBaseArticle;
};

type KnowledgeBaseFormState = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: KnowledgeBaseStatus;
  category: string;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string | null;
  updatedAt: string | null;
};

const emptyFormState: KnowledgeBaseFormState = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  status: "DRAFT",
  category: "",
  seoTitle: "",
  seoDescription: "",
  publishedAt: null,
  updatedAt: null,
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function mapArticleToForm(article: KnowledgeBaseArticle): KnowledgeBaseFormState {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt || "",
    content: article.content,
    status: article.status,
    category: article.category || "",
    seoTitle: article.seoTitle || "",
    seoDescription: article.seoDescription || "",
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
  };
}

export default function KnowledgeBaseAdminPage() {
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [form, setForm] = useState<KnowledgeBaseFormState>(emptyFormState);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const selectedArticleId = form.id;

  const publishedCount = useMemo(
    () => articles.filter((article) => article.status === "PUBLISHED").length,
    [articles]
  );

  async function requestJson<T extends MutationResponse>(
    url: string,
    init?: RequestInit
  ) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${getCookie("session")}`,
        ...(init?.headers || {}),
      },
    });

    if (!hasAccess(response)) {
      const body = (await response.json().catch(() => null)) as MutationResponse | null;
      throw new Error(body?.message || "Unauthorized");
    }

    const body = (await response.json()) as T;
    if (!response.ok || body.success === false) {
      throw new Error(body.message || "Request failed");
    }

    return body;
  }

  async function loadArticles(nextSelectedId?: string | null) {
    setLoadingList(true);
    try {
      const data = await requestJson<ArticlesResponse>("/api/v1/kb/articles");
      const nextArticles = data.articles || [];
      setArticles(nextArticles);

      const articleToLoad =
        nextSelectedId ||
        (selectedArticleId &&
        nextArticles.some((article) => article.id === selectedArticleId)
          ? selectedArticleId
          : nextArticles[0]?.id);

      if (articleToLoad) {
        await loadArticle(articleToLoad);
      } else {
        handleNewArticle();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to load knowledge base",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setLoadingList(false);
    }
  }

  async function loadArticle(articleId: string) {
    setLoadingArticle(true);
    try {
      const data = await requestJson<ArticleResponse>(`/api/v1/kb/article/${articleId}`);
      if (!data.article) {
        throw new Error("Knowledge base article not found");
      }

      setForm(mapArticleToForm(data.article));
      setSlugTouched(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to load article",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setLoadingArticle(false);
    }
  }

  function handleNewArticle() {
    setForm(emptyFormState);
    setSlugTouched(false);
  }

  useEffect(() => {
    void loadArticles(null);
  }, []);

  const handleTitleChange = (value: string) => {
    setForm((current) => ({
      ...current,
      title: value,
      slug: slugTouched ? current.slug : slugify(value),
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({
        variant: "destructive",
        title: "Title is required",
        description: "Add a title before saving this article.",
      });
      return;
    }

    if (!form.content.trim()) {
      toast({
        variant: "destructive",
        title: "Content is required",
        description: "Add article content before saving this article.",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt || undefined,
        content: form.content,
        status: form.status,
        category: form.category || undefined,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
      };

      const url = form.id
        ? `/api/v1/kb/article/${form.id}/update`
        : "/api/v1/kb/article/create";
      const method = form.id ? "PUT" : "POST";

      const data = await requestJson<MutationResponse>(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!data.article) {
        throw new Error("Knowledge base article not returned");
      }

      setForm(mapArticleToForm(data.article));
      setSlugTouched(true);
      await loadArticles(data.article.id);

      toast({
        title: form.id ? "Article updated" : "Article created",
        description:
          form.status === "PUBLISHED"
            ? "The public article is now available."
            : "The draft has been saved.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to save article",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) {
      handleNewArticle();
      return;
    }

    if (!window.confirm("Delete this knowledge base article?")) {
      return;
    }

    setDeleting(true);
    try {
      await requestJson(`/api/v1/kb/article/${form.id}/delete`, {
        method: "DELETE",
      });

      toast({
        title: "Article deleted",
        description: "The knowledge base article has been removed.",
      });

      setForm(emptyFormState);
      setSlugTouched(false);
      await loadArticles(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to delete article",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Public Knowledge Base
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            Manage help articles
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Drafts stay private. Published articles are exposed through the public
            knowledge base app and rendered with server-side sanitation.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="rounded-full border px-3 py-1">
            {articles.length} total
          </span>
          <span className="rounded-full border px-3 py-1">
            {publishedCount} published
          </span>
          <Button onClick={handleNewArticle}>New article</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Articles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingList ? (
              <p className="text-sm text-muted-foreground">Loading articles...</p>
            ) : articles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No article yet. Start by creating a draft.
              </p>
            ) : (
              articles.map((article) => (
                <button
                  key={article.id}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    article.id === selectedArticleId
                      ? "border-emerald-500 bg-emerald-50"
                      : "hover:border-foreground/30"
                  }`}
                  onClick={() => {
                    void loadArticle(article.id);
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="line-clamp-2 text-sm font-semibold text-foreground">
                      {article.title}
                    </h2>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        article.status === "PUBLISHED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {article.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    /articles/{article.slug}
                  </p>
                  {article.category ? (
                    <p className="mt-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                      {article.category}
                    </p>
                  ) : null}
                  {article.excerpt ? (
                    <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                      {article.excerpt}
                    </p>
                  ) : null}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {form.id ? "Edit article" : "Create a new knowledge base article"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingArticle ? (
              <p className="text-sm text-muted-foreground">Loading article...</p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="kb-title">Title</Label>
                    <Input
                      id="kb-title"
                      value={form.title}
                      onChange={(event) => handleTitleChange(event.target.value)}
                      placeholder="How to reset a user password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kb-slug">Slug</Label>
                    <Input
                      id="kb-slug"
                      value={form.slug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        setForm((current) => ({
                          ...current,
                          slug: slugify(event.target.value),
                        }));
                      }}
                      placeholder="how-to-reset-a-user-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(value: KnowledgeBaseStatus) => {
                        setForm((current) => ({
                          ...current,
                          status: value,
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="PUBLISHED">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kb-category">Category</Label>
                    <Input
                      id="kb-category"
                      value={form.category}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                      placeholder="Account, Billing, Setup..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Publication</Label>
                    <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      {form.publishedAt
                        ? new Date(form.publishedAt).toLocaleString()
                        : "Not published yet"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kb-excerpt">Excerpt</Label>
                  <textarea
                    id="kb-excerpt"
                    value={form.excerpt}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        excerpt: event.target.value,
                      }))
                    }
                    placeholder="Short summary used on the public list and as SEO fallback."
                    className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kb-content">Content</Label>
                  <textarea
                    id="kb-content"
                    value={form.content}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        content: event.target.value,
                      }))
                    }
                    placeholder="<p>Public article content. Basic HTML is allowed and sanitized on public rendering.</p>"
                    className="min-h-[320px] w-full rounded-md border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    The public app sanitizes rendered HTML. Use semantic tags such as
                    paragraphs, headings, lists, code blocks and links.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="kb-seo-title">SEO title</Label>
                    <Input
                      id="kb-seo-title"
                      value={form.seoTitle}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          seoTitle: event.target.value,
                        }))
                      }
                      placeholder="Optional. Falls back to the article title."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Last update</Label>
                    <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      {form.updatedAt
                        ? new Date(form.updatedAt).toLocaleString()
                        : "Never saved"}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="kb-seo-description">SEO description</Label>
                    <textarea
                      id="kb-seo-description"
                      value={form.seoDescription}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          seoDescription: event.target.value,
                        }))
                      }
                      placeholder="Optional. Falls back to the excerpt."
                      className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button disabled={saving} onClick={() => void handleSave()}>
                    {saving ? "Saving..." : form.id ? "Save article" : "Create article"}
                  </Button>
                  <Button
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                    type="button"
                    variant="outline"
                  >
                    {deleting
                      ? "Deleting..."
                      : form.id
                        ? "Delete article"
                        : "Reset draft"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
