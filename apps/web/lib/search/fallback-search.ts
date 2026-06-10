import { listArtifacts } from "../artifacts";
import type { Artifact } from "../types";
import { orderArtifactsByIds } from "./rrf";
import { rankArtifactsByScore, scoreForSuggest } from "./scoring";

/** Prefix/tag autocomplete backup when LLM or hybrid search under-delivers. */
export async function autocompleteSearchBackup(
  query: string,
  keywords: string[] = [],
  preferredIds: string[] = [],
  limit = 20,
): Promise<Artifact[]> {
  const trimmed = query.trim();
  if (!trimmed) return listArtifacts();

  const all = await listArtifacts();
  const terms = keywords.length ? keywords : [trimmed];

  const byId = new Map(all.map((a) => [a.id, a]));
  const ordered: Artifact[] = [];

  for (const id of preferredIds) {
    const artifact = byId.get(id);
    if (artifact) ordered.push(artifact);
  }

  const prefixRanked = all
    .map((artifact) => ({ artifact, score: scoreForSuggest(artifact, trimmed) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ artifact }) => artifact);

  for (const artifact of prefixRanked) {
    if (!ordered.some((a) => a.id === artifact.id)) ordered.push(artifact);
  }

  const keywordRanked = rankArtifactsByScore(all, trimmed, terms);
  for (const artifact of keywordRanked) {
    if (!ordered.some((a) => a.id === artifact.id)) ordered.push(artifact);
  }

  if (preferredIds.length) {
    return orderArtifactsByIds(ordered, preferredIds).slice(0, limit);
  }

  return ordered.slice(0, limit);
}

export function needsSearchBackup(
  query: string,
  results: Artifact[],
  source: "llm" | "fallback",
): boolean {
  if (!results.length) return true;
  if (query.trim().length < 3) return false;

  if (source === "fallback" && results.length < 3) return true;

  const q = query.trim().toLowerCase();
  const top = results[0];
  if (!top) return true;

  const title = top.title.toLowerCase();
  const tags = top.tags.map((t) => t.toLowerCase());
  const directHit =
    title.includes(q) ||
    title.split(/\s+/).some((w) => w.startsWith(q)) ||
    tags.some((t) => t.startsWith(q) || t.includes(q));

  return !directHit && results.length < 5;
}
