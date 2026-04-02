const TEMPLATE_TOKEN_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderEmailTemplate(
  template: string | null | undefined,
  values: Record<string, string>
) {
  if (!template) {
    return "";
  }

  return template.replace(TEMPLATE_TOKEN_REGEX, (_match, key: string) => {
    return values[key] ?? "";
  });
}
