/** Strip HTML tags and collapse whitespace for search / LLM metadata. */
export function extractTextFromHtml(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 50_000);
}

export async function extractContentText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (mimeType === "text/html") {
    return extractTextFromHtml(buffer.toString("utf-8"));
  }
  // PDF/image text extraction deferred to LLM step
  return "";
}

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
    .slice(0, 120);
}

export function parseTags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[,#]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10),
    ),
  ];
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}
