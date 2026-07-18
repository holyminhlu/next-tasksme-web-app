/** Strip HTML/script tags and normalize whitespace for user-authored text. */
export function sanitizePlainText(input: string, maxLength = 5000): string {
  const withoutTags = input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  const collapsed = withoutTags.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, maxLength);
}

/** Extract @mention tokens that look like emails or bare user ids (uuid). */
export function extractMentionTokens(content: string): string[] {
  const matches = content.match(/@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[0-9a-f-]{36})/gi);
  if (!matches) return [];
  return [...new Set(matches.map((token) => token.slice(1)))];
}
