import { listArtifacts } from "../artifacts";
import { embedText } from "../embeddings";
import { logEvent } from "../observability/log";
import type { Artifact } from "../types";
import {
  autocompleteSearchBackup,
  needsSearchBackup,
} from "./fallback-search";
import { resolveSearchPlan } from "./llm-search";
import { mergeRankedArtifactLists, orderArtifactsByIds } from "./rrf";
import { rerankWithLlm } from "./rerank-llm";
import { rankArtifactsByScore } from "./scoring";
import { suggestArtifactIds } from "./suggest";
import {
  ftsSearchArtifacts,
  textSearchArtifactsFallback,
  vectorSearchArtifacts,
} from "./supabase-search";

function buildFtsQuery(
  original: string,
  keywords: string[],
  tags: string[],
): string {
  const parts = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length > 1) parts.add(t);
  };

  add(original);
  for (const kw of keywords) add(kw);
  for (const tag of tags) add(tag);

  return [...parts].join(" OR ");
}

export async function searchArtifacts(query: string): Promise<Artifact[]> {
  const trimmed = query.trim();
  if (!trimmed) return listArtifacts();

  const start = Date.now();
  const { plan, source: planSource } = await resolveSearchPlan(trimmed);
  const keywords = plan.keywords;
  const ftsQuery = buildFtsQuery(trimmed, keywords, plan.tags);
  const lists: Artifact[][] = [];

  const ftsResults = await ftsSearchArtifacts(ftsQuery);
  if (ftsResults.length > 0) {
    lists.push(ftsResults);
    lists.push(ftsResults);
  } else {
    const fallback = await textSearchArtifactsFallback(
      keywords.join(" ") || trimmed,
    );
    if (fallback.length > 0) lists.push(fallback);
  }

  const semanticText = plan.semanticQuery || trimmed;
  const queryEmbedding = await embedText(semanticText, "query");
  if (queryEmbedding) {
    const threshold = trimmed.length < 8 ? 0.3 : 0.22;
    const vectorResults = await vectorSearchArtifacts(
      queryEmbedding,
      30,
      threshold,
    );
    if (vectorResults.length > 0) lists.push(vectorResults);
  }

  const all = await listArtifacts();
  const tagMatched = plan.tags.length
    ? all.filter((artifact) =>
        plan.tags.some((tag) =>
          artifact.tags.some((t) => t.toLowerCase().includes(tag)),
        ),
      )
    : [];
  if (tagMatched.length) lists.push(tagMatched);

  let merged: Artifact[] = [];
  if (lists.length > 0) {
    merged =
      lists.length === 1 ? lists[0]! : mergeRankedArtifactLists(lists);
    merged = rankArtifactsByScore(merged, trimmed, keywords);
  }

  if (merged.length > 1) {
    merged = await rerankWithLlm(trimmed, merged);
  }

  if (needsSearchBackup(trimmed, merged, planSource)) {
    const backupIds = await suggestArtifactIds(trimmed, keywords);
    const backup = await autocompleteSearchBackup(
      trimmed,
      keywords,
      backupIds,
    );

    if (!merged.length) {
      merged = backup;
    } else {
      const seen = new Set(merged.map((a) => a.id));
      for (const artifact of backup) {
        if (!seen.has(artifact.id)) merged.push(artifact);
      }
      if (backupIds.length) {
        merged = orderArtifactsByIds(merged, backupIds);
      }
    }
  }

  logEvent({
    type: "pipeline",
    operation: "search",
    ok: true,
    ms: Date.now() - start,
    meta: {
      queryLen: trimmed.length,
      resultCount: merged.length,
      planSource,
    },
  });

  return merged;
}

export { suggestSearch } from "./suggest";
export type { SearchSuggestion, SuggestResponse } from "./suggest";
