import { describe, it, expect } from "vitest";
import {
  sanitizeEmailHeader,
  sanitizeEmailAddress,
  sanitizeTemplateValue,
} from "./sanitize";

describe("sanitizeEmailHeader", () => {
  it("strips carriage return", () => {
    expect(sanitizeEmailHeader("subject\r\nBcc: evil@attacker.com")).toBe(
      "subjectBcc: evil@attacker.com"
    );
  });

  it("strips newline", () => {
    expect(sanitizeEmailHeader("subject\nBcc: evil@attacker.com")).toBe(
      "subjectBcc: evil@attacker.com"
    );
  });

  it("strips null bytes", () => {
    expect(sanitizeEmailHeader("test\0value")).toBe("testvalue");
  });

  it("passes clean values through", () => {
    expect(sanitizeEmailHeader("Normal Subject Line")).toBe(
      "Normal Subject Line"
    );
  });

  it("strips multiple injection attempts", () => {
    expect(
      sanitizeEmailHeader("test\r\nBcc: a@b.com\r\nCc: c@d.com")
    ).toBe("testBcc: a@b.comCc: c@d.com");
  });
});

describe("sanitizeEmailAddress", () => {
  it("accepts valid email", () => {
    expect(sanitizeEmailAddress("user@example.com")).toBe("user@example.com");
  });

  it("trims whitespace", () => {
    expect(sanitizeEmailAddress("  user@example.com  ")).toBe(
      "user@example.com"
    );
  });

  it("throws on CRLF injection", () => {
    expect(() =>
      sanitizeEmailAddress("test@example.com\r\nBcc:evil@attacker.com")
    ).toThrow();
  });

  it("throws on newline injection", () => {
    expect(() =>
      sanitizeEmailAddress("test@example.com\nBcc:evil@attacker.com")
    ).toThrow();
  });

  it("throws on invalid email format", () => {
    expect(() => sanitizeEmailAddress("not-an-email")).toThrow();
  });

  it("throws on empty string", () => {
    expect(() => sanitizeEmailAddress("")).toThrow();
  });

  it("throws on email exceeding 254 chars", () => {
    const longEmail = "a".repeat(250) + "@b.com";
    expect(() => sanitizeEmailAddress(longEmail)).toThrow(
      "Email address exceeds maximum length"
    );
  });

  it("throws on email with spaces", () => {
    expect(() => sanitizeEmailAddress("user @example.com")).toThrow();
  });

  it("accepts email with subdomains", () => {
    expect(sanitizeEmailAddress("user@sub.domain.example.com")).toBe(
      "user@sub.domain.example.com"
    );
  });

  it("accepts email with plus addressing", () => {
    expect(sanitizeEmailAddress("user+tag@example.com")).toBe(
      "user+tag@example.com"
    );
  });
});

describe("sanitizeTemplateValue", () => {
  it("strips script tags", () => {
    expect(sanitizeTemplateValue('<script>alert("XSS")</script>')).toBe("");
  });

  it("strips event handlers", () => {
    expect(
      sanitizeTemplateValue('<div onload="alert(1)">test</div>')
    ).toBe("<div>test</div>");
  });

  it("preserves safe HTML", () => {
    expect(sanitizeTemplateValue("<p>Hello <strong>world</strong></p>")).toBe(
      "<p>Hello <strong>world</strong></p>"
    );
  });

  it("preserves links with href", () => {
    const input = '<a href="https://example.com">link</a>';
    expect(sanitizeTemplateValue(input)).toBe(input);
  });

  it("strips javascript: URLs", () => {
    const result = sanitizeTemplateValue(
      '<a href="javascript:alert(1)">click</a>'
    );
    expect(result).not.toContain("javascript:");
  });

  it("strips img tags (not in allowlist)", () => {
    expect(
      sanitizeTemplateValue('<img src="https://evil.com/pixel.gif" />')
    ).toBe("");
  });

  it("handles empty string", () => {
    expect(sanitizeTemplateValue("")).toBe("");
  });

  it("strips nested XSS", () => {
    expect(
      sanitizeTemplateValue(
        '<div><p><script>document.cookie</script></p></div>'
      )
    ).toBe("<div><p></p></div>");
  });
});
