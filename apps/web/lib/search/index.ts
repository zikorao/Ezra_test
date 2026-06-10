import { listArtifacts } from "../artifacts";
import { embedText } from "../embeddings";
import { parseSearchQuery, isLlmAvailable } from "../llm";
import type { Artifact } from "../types";
import { mergeRankedArtifactLists } from "./rrf";
import { rerankWithLlm } from "./rerank-llm";
import {
  ftsSearchArtifacts,
  textSearchArtifactsFallback,
  vectorSearchArtifacts,
} from "./supabase-search";

function matchesKeyword(artifact: Artifact, keyword: string): boolean {
  const k = keyword.toLowerCase();
  const haystack = [
    artifact.title,
    artifact.description,
    artifact.content_text,
    artifact.mime_type,
    ...artifact.tags,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(k);
}

function keywordSearch(artifacts: Artifact[], keywords: string[]): Artifact[] {
  if (keywords.length === 0) return [];

  return artifacts
    .map((artifact) => ({
      artifact,
      score: keywords.filter((kw) => matchesKeyword(artifact, kw)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ artifact }) => artifact);
}

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

export async function searchArtifacts(query: string): Promise<Artifact[]> {
  const trimmed = query.trim();
  if (!trimmed) return listArtifacts();

  let keywords: string[];
  if (await isLlmAvailable()) {
    try {
      keywords = await parseSearchQuery(trimmed);
    } catch {
      keywords = trimmed.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    }
  } else {
    keywords = trimmed.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  }

  const ftsQuery = buildFtsQuery(trimmed, keywords);
  const lists: Artifact[][] = [];

  const ftsResults = await ftsSearchArtifacts(ftsQuery);
  if (ftsResults.length > 0) {
    lists.push(ftsResults);
    lists.push(ftsResults);
  } else {
    const fallback = await textSearchArtifactsFallback(trimmed);
    if (fallback.length > 0) lists.push(fallback);
  }

  const queryEmbedding = await embedText(trimmed, "query");
  if (queryEmbedding) {
    const vectorResults = await vectorSearchArtifacts(queryEmbedding);
    if (vectorResults.length > 0) lists.push(vectorResults);
  }

  const all = await listArtifacts();
  const keywordResults = keywordSearch(all, keywords.length ? keywords : [trimmed]);
  if (keywordResults.length > 0) lists.push(keywordResults);

  if (lists.length === 0) return [];

  let merged =
    lists.length === 1 ? lists[0]! : mergeRankedArtifactLists(lists);

  merged = await rerankWithLlm(trimmed, merged);
  return merged;
}
