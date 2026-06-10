import type { Artifact } from "../types";
import { listArtifacts } from "../artifacts";
import { parseSearchQuery, isLlmAvailable } from "../llm";

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

export async function searchArtifacts(query: string): Promise<Artifact[]> {
  const trimmed = query.trim();
  if (!trimmed) return listArtifacts();

  const all = await listArtifacts();
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

  if (keywords.length === 0) return all;

  const scored = all
    .map((artifact) => {
      const score = keywords.filter((kw) => matchesKeyword(artifact, kw)).length;
      return { artifact, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ artifact }) => artifact);
}
