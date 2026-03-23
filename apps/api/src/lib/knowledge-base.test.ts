import { describe, expect, it } from "vitest";
import { KnowledgeBaseStatus } from "@prisma/client";
import {
  buildKnowledgeBaseExcerpt,
  buildKnowledgeBaseSeoDescription,
  normalizeKnowledgeBaseSlug,
  resolveKnowledgeBasePublishedAt,
  sanitizeKnowledgeBasePublicContent,
} from "./knowledge-base";

describe("knowledge base helpers", () => {
  it("normalizes slugs to lowercase dash-separated values", () => {
    expect(normalizeKnowledgeBaseSlug("  FAQ de l'équipe Support  ")).toBe(
      "faq-de-lequipe-support"
    );
  });

  it("builds an excerpt from HTML content when none is provided", () => {
    expect(
      buildKnowledgeBaseExcerpt(undefined, "<p>Hello <strong>world</strong></p>")
    ).toBe("Hello world");
  });

  it("generates a short SEO description fallback", () => {
    expect(
      buildKnowledgeBaseSeoDescription(
        undefined,
        undefined,
        "<p>This is a public answer that should become a concise description.</p>"
      )
    ).toContain("This is a public answer");
  });

  it("sanitizes public content before rendering", () => {
    expect(
      sanitizeKnowledgeBasePublicContent(
        '<p>safe</p><script>alert("xss")</script><a href="https://example.com" target="_blank">link</a>'
      )
    ).toBe(
      '<p>safe</p><a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>'
    );
  });

  it("resolves publication dates only for published articles", () => {
    expect(resolveKnowledgeBasePublishedAt(KnowledgeBaseStatus.DRAFT)).toBeNull();
    expect(
      resolveKnowledgeBasePublishedAt(KnowledgeBaseStatus.PUBLISHED)
    ).toBeInstanceOf(Date);
  });
});
