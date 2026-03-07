import sanitizeHtml from "sanitize-html";

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Strip characters that could enable SMTP header injection.
 */
export function sanitizeEmailHeader(value: string): string {
  return value.replace(/[\r\n\0]/g, "");
}

/**
 * Validate and sanitize an email address to prevent header injection.
 * Throws if the address is not a valid email format.
 */
export function sanitizeEmailAddress(email: string): string {
  const cleaned = sanitizeEmailHeader(email).trim();
  if (cleaned.length > 254) {
    throw new Error("Email address exceeds maximum length");
  }
  if (!EMAIL_REGEX.test(cleaned)) {
    throw new Error(`Invalid email address: ${cleaned}`);
  }
  return cleaned;
}

const emailHtmlSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "a", "b", "i", "strong", "em",
    "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "pre", "code", "div", "span",
    "table", "thead", "tbody", "tr", "td", "th",
  ],
  allowedAttributes: {
    a: ["href"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  disallowedTagsMode: "discard",
};

/**
 * Sanitize HTML content before injecting into email templates.
 * Prevents stored XSS via Handlebars template variables.
 */
export function sanitizeTemplateValue(value: string): string {
  return sanitizeHtml(value, emailHtmlSanitizeOptions);
}
