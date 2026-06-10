import type { ArtifactMetadata } from "./types";

export function parseMetadataJson(raw: string): ArtifactMetadata | null {
  try {
    const parsed = JSON.parse(raw) as {
      title?: string;
      description?: string;
      tags?: string[] | string;
    };

    const title = String(parsed.title ?? "").trim().slice(0, 120);
    const description = String(parsed.description ?? "").trim().slice(0, 500);
    let tags: string[] = [];

    if (Array.isArray(parsed.tags)) {
      tags = parsed.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    } else if (typeof parsed.tags === "string") {
      tags = parsed.tags.split(/[,#]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    }

    tags = [...new Set(tags)].slice(0, 8);

    if (!title && !description && tags.length === 0) return null;
    return { title, description, tags };
  } catch {
    return null;
  }
}

export function parseSearchKeywordsJson(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as { keywords?: string[] };
    if (Array.isArray(parsed.keywords)) {
      return parsed.keywords
        .map((k) => String(k).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);
    }
  } catch {
    // fall through
  }
  return [];
}
