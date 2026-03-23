import { KnowledgeBaseStatus } from "@prisma/client";
import sanitizeHtml from "sanitize-html";

const EXCERPT_MAX_LENGTH = 220;
const SEO_DESCRIPTION_MAX_LENGTH = 160;

const PUBLIC_KB_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "blockquote",
    "br",
    "code",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height", "loading"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
  transformTags: {
    a: (tagName, attribs) => {
      const nextAttribs = { ...attribs };
      const rel = new Set((nextAttribs.rel || "").split(/\s+/).filter(Boolean));
      rel.add("noopener");
      rel.add("noreferrer");
      nextAttribs.rel = Array.from(rel).join(" ");

      if (nextAttribs.target !== "_blank") {
        delete nextAttribs.target;
      }

      return { tagName, attribs: nextAttribs };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        loading: "lazy",
      },
    }),
  },
};

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

export function normalizeKnowledgeBaseSlug(value: string) {
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

export function stripKnowledgeBaseHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeKnowledgeBaseText(value?: string | null) {
  const cleaned = stripKnowledgeBaseHtml(value || "");
  return cleaned.length > 0 ? cleaned : null;
}

export function buildKnowledgeBaseExcerpt(
  excerpt: string | null | undefined,
  content: string
) {
  const cleanedExcerpt = sanitizeKnowledgeBaseText(excerpt);
  if (cleanedExcerpt) {
    return truncate(cleanedExcerpt, EXCERPT_MAX_LENGTH);
  }

  const contentText = sanitizeKnowledgeBaseText(content);
  if (!contentText) {
    return null;
  }

  return truncate(contentText, EXCERPT_MAX_LENGTH);
}

export function buildKnowledgeBaseSeoTitle(
  seoTitle: string | null | undefined,
  title: string
) {
  return sanitizeKnowledgeBaseText(seoTitle) || title.trim();
}

export function buildKnowledgeBaseSeoDescription(
  seoDescription: string | null | undefined,
  excerpt: string | null | undefined,
  content: string
) {
  const cleanedSeoDescription = sanitizeKnowledgeBaseText(seoDescription);
  if (cleanedSeoDescription) {
    return truncate(cleanedSeoDescription, SEO_DESCRIPTION_MAX_LENGTH);
  }

  const nextExcerpt = buildKnowledgeBaseExcerpt(excerpt, content);
  if (!nextExcerpt) {
    return null;
  }

  return truncate(nextExcerpt, SEO_DESCRIPTION_MAX_LENGTH);
}

export function sanitizeKnowledgeBasePublicContent(content: string) {
  return sanitizeHtml(content, PUBLIC_KB_SANITIZE_OPTIONS);
}

export function resolveKnowledgeBasePublishedAt(
  status: KnowledgeBaseStatus,
  currentPublishedAt?: Date | null
) {
  if (status !== KnowledgeBaseStatus.PUBLISHED) {
    return null;
  }

  return currentPublishedAt || new Date();
}
