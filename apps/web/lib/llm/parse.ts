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

export type ParsedSearchPlan = {
  keywords: string[];
  semanticQuery: string;
  tags: string[];
};

export function parseSearchPlanJson(raw: string): ParsedSearchPlan | null {
  try {
    const parsed = JSON.parse(raw) as {
      keywords?: string[];
      semanticQuery?: string;
      tags?: string[];
    };

    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords
          .map((k) => String(k).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 8)
      : [];

    const semanticQuery = String(parsed.semanticQuery ?? "").trim();
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .map((t) => String(t).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    if (!keywords.length && !semanticQuery && !tags.length) return null;
    return { keywords, semanticQuery, tags };
  } catch {
    return null;
  }
}

export type ParsedSuggestResult = {
  artifactIndexes: number[];
  keywords: string[];
  tags: string[];
};

export function parseSuggestJson(raw: string): ParsedSuggestResult | null {
  try {
    const parsed = JSON.parse(raw) as {
      artifacts?: number[];
      artifactIndexes?: number[];
      keywords?: string[];
      tags?: string[];
    };

    const indexes = Array.isArray(parsed.artifacts)
      ? parsed.artifacts
      : parsed.artifactIndexes;

    const artifactIndexes = Array.isArray(indexes)
      ? indexes
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n >= 1)
          .slice(0, 8)
      : [];

    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords
          .map((k) => String(k).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .map((t) => String(t).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    if (!artifactIndexes.length && !keywords.length && !tags.length) return null;
    return { artifactIndexes, keywords, tags };
  } catch {
    return null;
  }
}
