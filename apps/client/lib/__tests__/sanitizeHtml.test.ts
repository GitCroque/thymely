import { describe, it, expect } from "vitest";
import { sanitizeEmailHtml } from "../sanitizeHtml";

describe("sanitizeEmailHtml", () => {
  it("strips <script> tags", () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    expect(sanitizeEmailHtml(input)).toBe("<p>Hello</p>");
  });

  it("strips event handler attributes (onerror, onload)", () => {
    const input = '<img src="x.png" onerror="alert(1)">';
    const result = sanitizeEmailHtml(input);
    expect(result).not.toContain("onerror");
    expect(result).toContain("src");
  });

  it("strips javascript: URIs from href", () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeEmailHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("strips <iframe> tags", () => {
    const input = '<iframe src="https://evil.com"></iframe><p>safe</p>';
    expect(sanitizeEmailHtml(input)).toBe("<p>safe</p>");
  });

  it("strips <object> and <embed> tags", () => {
    const input = '<object data="evil.swf"></object><embed src="evil.swf"><p>ok</p>';
    expect(sanitizeEmailHtml(input)).toBe("<p>ok</p>");
  });

  it("strips <form> and <input> tags (phishing)", () => {
    const input = '<form action="https://evil.com"><input type="text"><p>text</p></form>';
    const result = sanitizeEmailHtml(input);
    expect(result).not.toContain("<form");
    expect(result).not.toContain("<input");
    expect(result).toContain("<p>text</p>");
  });

  it("strips style attributes (CSS injection)", () => {
    const input = '<div style="background:url(https://tracker.com/px)">text</div>';
    const result = sanitizeEmailHtml(input);
    expect(result).not.toContain("style");
    expect(result).toContain("text");
  });

  it("strips data: URIs from img src", () => {
    const input = '<img src="data:text/html,<script>alert(1)</script>">';
    const result = sanitizeEmailHtml(input);
    expect(result).not.toContain("data:");
  });

  it("handles double-encoded XSS attempts", () => {
    const input = "<p>%3Cscript%3Ealert(1)%3C/script%3E</p>";
    const result = sanitizeEmailHtml(input);
    expect(result).not.toContain("<script");
  });

  it("strips <svg> with onload", () => {
    const input = '<svg onload="alert(1)"><circle></circle></svg>';
    const result = sanitizeEmailHtml(input);
    expect(result).not.toContain("svg");
    expect(result).not.toContain("onload");
  });

  it("preserves safe email HTML (tables, images, links)", () => {
    const input =
      '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>' +
      '<img src="https://example.com/logo.png" alt="logo">' +
      '<a href="https://example.com">Link</a>' +
      "<p><strong>Bold</strong> and <em>italic</em></p>";
    const result = sanitizeEmailHtml(input);
    expect(result).toContain("<table>");
    expect(result).toContain("<th>Header</th>");
    expect(result).toContain("<td>Cell</td>");
    expect(result).toContain('src="https://example.com/logo.png"');
    expect(result).toContain('alt="logo"');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain("<strong>Bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });

  it("preserves heading tags", () => {
    const input = "<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>";
    expect(sanitizeEmailHtml(input)).toBe(input);
  });

  it("preserves list elements", () => {
    const input = "<ul><li>Item 1</li><li>Item 2</li></ul>";
    expect(sanitizeEmailHtml(input)).toBe(input);
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeEmailHtml("")).toBe("");
  });

  it("strips <meta> refresh redirect", () => {
    const input = '<meta http-equiv="refresh" content="0;url=https://evil.com"><p>safe</p>';
    const result = sanitizeEmailHtml(input);
    expect(result).not.toContain("<meta");
    expect(result).toContain("<p>safe</p>");
  });
});
