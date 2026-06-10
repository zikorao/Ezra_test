import { listArtifacts } from "../artifacts";
import { embedText } from "../embeddings";
import { parseSearchQuery, isLlmAvailable } from "../llm";
import type { Artifact } from "../types";
import { mergeRankedArtifactLists } from "./rrf";
import { rerankWithLlm } from "./rerank-llm";
import { isShortQuery, rankArtifactsByScore, tokenizeQuery } from "./scoring";
import {
  ftsSearchArtifacts,
  textSearchArtifactsFallback,
  vectorSearchArtifacts,
} from "./supabase-search";

function buildFtsQuery(original: string, keywords: string[]): string {
  const parts = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length > 1) parts.add(t);
  };

  add(original);
  for (const kw of keywords) add(kw);

  return [...parts].join(" OR ");
}

async function resolveKeywords(query: string): Promise<string[]> {
  const tokens = tokenizeQuery(query);
  if (isShortQuery(query)) return tokens;

  if (await isLlmAvailable()) {
    try {
      return await parseSearchQuery(query);
    } catch {
      return tokens.filter((w) => w.length > 2);
    }
  }

  return tokens.filter((w) => w.length > 2);
}

export async function searchArtifacts(query: string): Promise<Artifact[]> {
  const trimmed = query.trim();
  if (!trimmed) return listArtifacts();

  const short = isShortQuery(trimmed);
  const keywords = await resolveKeywords(trimmed);
  const ftsQuery = buildFtsQuery(trimmed, keywords);
  const lists: Artifact[][] = [];

  const all = await listArtifacts();
  const prefixRanked = rankArtifactsByScore(all, trimmed, keywords);
  if (prefixRanked.length > 0) {
    lists.push(prefixRanked);
    if (short) lists.push(prefixRanked);
  }

  const ftsResults = await ftsSearchArtifacts(ftsQuery);
  if (ftsResults.length > 0) {
    lists.push(ftsResults);
    lists.push(ftsResults);
  } else if (!short) {
    const fallback = await textSearchArtifactsFallback(trimmed);
    if (fallback.length > 0) lists.push(fallback);
  }

  if (!short) {
    const queryEmbedding = await embedText(trimmed, "query");
    if (queryEmbedding) {
      const threshold = trimmed.length < 12 ? 0.28 : 0.22;
      const vectorResults = await vectorSearchArtifacts(
        queryEmbedding,
        30,
        threshold,
      );
      if (vectorResults.length > 0) lists.push(vectorResults);
    }
  }

  if (lists.length === 0) return [];

  let merged =
    lists.length === 1 ? lists[0]! : mergeRankedArtifactLists(lists);

  merged = rankArtifactsByScore(merged, trimmed, keywords);

  if (!short && merged.length > 1) {
    merged = await rerankWithLlm(trimmed, merged);
  }

  return merged;
}

export { suggestSearch } from "./suggest";
export type { SearchSuggestion } from "./suggest";
