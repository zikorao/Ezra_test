import { listArtifacts } from "../artifacts";
import { logEvent } from "../observability/log";
import { resolveLlmSuggestions } from "./llm-search";
import { rankArtifactsByScore, scoreForSuggest } from "./scoring";

export type SearchSuggestion =
  | {
      kind: "query";
      label: string;
      href: string;
    }
  | {
      kind: "artifact";
      id: string;
      title: string;
      subtitle: string;
      href: string;
    }
  | {
      kind: "tag";
      label: string;
      href: string;
    };

export type SuggestResponse = {
  suggestions: SearchSuggestion[];
  source: "llm" | "autocomplete";
};

function buildPrefixSuggestions(
  prefix: string,
  all: Awaited<ReturnType<typeof listArtifacts>>,
  limit: number,
): SearchSuggestion[] {
  const q = prefix.trim();
  const lower = q.toLowerCase();
  const suggestions: SearchSuggestion[] = [];

  suggestions.push({
    kind: "query",
    label: `Search “${q}”`,
    href: `/?q=${encodeURIComponent(q)}`,
  });

  const tagHits = new Map<string, number>();
  for (const artifact of all) {
    for (const tag of artifact.tags) {
      const t = tag.toLowerCase();
      if (t.startsWith(lower) || t.includes(lower)) {
        const boost = t.startsWith(lower) ? 2 : 1;
        tagHits.set(tag, (tagHits.get(tag) ?? 0) + boost);
      }
    }
  }

  [...tagHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([tag]) => {
      suggestions.push({
        kind: "tag",
        label: tag,
        href: `/?q=${encodeURIComponent(tag)}`,
      });
    });

  const ranked = all
    .map((artifact) => ({ artifact, score: scoreForSuggest(artifact, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  for (const { artifact } of ranked) {
    suggestions.push({
      kind: "artifact",
      id: artifact.id,
      title: artifact.title,
      subtitle:
        artifact.tags.slice(0, 3).join(" · ") ||
        artifact.description.slice(0, 60),
      href: `/artifacts/${artifact.id}`,
    });
  }

  return suggestions;
}

function buildLlmSuggestions(
  prefix: string,
  llm: NonNullable<Awaited<ReturnType<typeof resolveLlmSuggestions>>>,
  all: Awaited<ReturnType<typeof listArtifacts>>,
  limit: number,
): SearchSuggestion[] {
  const q = prefix.trim();
  const suggestions: SearchSuggestion[] = [];
  const byId = new Map(all.map((a) => [a.id, a]));

  const searchTerm = llm.keywords[0] ?? llm.tags[0] ?? q;
  suggestions.push({
    kind: "query",
    label: `Search “${searchTerm}”`,
    href: `/?q=${encodeURIComponent(searchTerm)}`,
  });

  for (const tag of llm.tags.slice(0, 3)) {
    const match = all.flatMap((a) => a.tags).find((t) => t.toLowerCase() === tag);
    suggestions.push({
      kind: "tag",
      label: match ?? tag,
      href: `/?q=${encodeURIComponent(match ?? tag)}`,
    });
  }

  for (const id of llm.artifactIds.slice(0, limit)) {
    const artifact = byId.get(id);
    if (!artifact) continue;
    suggestions.push({
      kind: "artifact",
      id: artifact.id,
      title: artifact.title,
      subtitle: artifact.tags.slice(0, 3).join(" · "),
      href: `/artifacts/${artifact.id}`,
    });
  }

  return suggestions;
}

function mergeSuggestions(
  primary: SearchSuggestion[],
  backup: SearchSuggestion[],
  limit: number,
): SearchSuggestion[] {
  const seen = new Set<string>();
  const merged: SearchSuggestion[] = [];

  for (const item of [...primary, ...backup]) {
    const key = `${item.kind}:${item.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit + 4) break;
  }

  return merged;
}

export async function suggestSearch(
  prefix: string,
  limit = 8,
): Promise<SuggestResponse> {
  const q = prefix.trim();
  if (q.length < 2) return { suggestions: [], source: "autocomplete" };

  const start = Date.now();
  const all = await listArtifacts();
  const backup = buildPrefixSuggestions(q, all, limit);

  const llm = await resolveLlmSuggestions(q);
  if (llm) {
    const primary = buildLlmSuggestions(q, llm, all, limit);
    if (primary.length > 1) {
      const response = {
        suggestions: mergeSuggestions(primary, backup, limit),
        source: "llm" as const,
      };
      logEvent({
        type: "pipeline",
        operation: "search.suggest",
        ok: true,
        ms: Date.now() - start,
        meta: { prefixLen: q.length, source: "llm", count: response.suggestions.length },
      });
      return response;
    }
  }

  const response = {
    suggestions: backup.slice(0, limit + 4),
    source: "autocomplete" as const,
  };
  logEvent({
    type: "pipeline",
    operation: "search.suggest",
    ok: true,
    ms: Date.now() - start,
    meta: { prefixLen: q.length, source: "autocomplete", count: response.suggestions.length },
  });
  return response;
}

/** Resolve artifact hits from autocomplete backup (used by main search). */
export async function suggestArtifactIds(
  query: string,
  extraKeywords: string[] = [],
): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const all = await listArtifacts();
  const llm = await resolveLlmSuggestions(q);
  const ids: string[] = [];

  if (llm?.artifactIds.length) ids.push(...llm.artifactIds);

  const prefixHits = all
    .map((artifact) => ({ artifact, score: scoreForSuggest(artifact, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ artifact }) => artifact.id);

  ids.push(...prefixHits);

  const keywordHits = rankArtifactsByScore(all, q, extraKeywords).map(
    (a) => a.id,
  );
  ids.push(...keywordHits);

  return [...new Set(ids)];
}
