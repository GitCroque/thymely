import DOMPurify from "isomorphic-dompurify";

/**
 * Allowlist aligned with the server-side sanitize-html config in imap.service.ts.
 * Defense-in-depth: even though IMAP HTML is sanitized server-side,
 * we re-sanitize client-side before rendering in the iframe.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "a",
  "b",
  "i",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "code",
  "img",
  "div",
  "span",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
];

const ALLOWED_ATTR = ["href", "src", "alt", "width", "height"];

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
  });
}
