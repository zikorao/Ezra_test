import type { Artifact } from "../types";

export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** True when query is short enough to prefer fast prefix matching over LLM. */
export function isShortQuery(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 4) return true;
  const words = tokenizeQuery(trimmed);
  return words.length === 1 && trimmed.length < 18;
}

export function scoreArtifact(
  artifact: Artifact,
  query: string,
  keywords: string[],
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const title = artifact.title.toLowerCase();
  const desc = artifact.description.toLowerCase();
  const tags = artifact.tags.map((t) => t.toLowerCase());
  const terms = keywords.length ? keywords : tokenizeQuery(q);

  let score = 0;

  if (title.startsWith(q)) score += 24;
  else if (title.includes(q)) score += 12;

  for (const tag of tags) {
    if (tag === q) score += 16;
    else if (tag.startsWith(q)) score += 10;
  }

  if (desc.includes(q)) score += 4;

  for (const term of terms) {
    if (term.length < 2) continue;
    if (title.startsWith(term)) score += 8;
    else if (title.includes(term)) score += 5;
    if (tags.some((t) => t === term || t.startsWith(term))) score += 6;
    if (desc.includes(term)) score += 2;
  }

  return score;
}

export function rankArtifactsByScore(
  artifacts: Artifact[],
  query: string,
  keywords: string[],
  minScore = 1,
): Artifact[] {
  return artifacts
    .map((artifact) => ({
      artifact,
      score: scoreArtifact(artifact, query, keywords),
    }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map(({ artifact }) => artifact);
}

export function scoreForSuggest(artifact: Artifact, prefix: string): number {
  const q = prefix.toLowerCase();
  let score = 0;
  const title = artifact.title.toLowerCase();

  if (title.startsWith(q)) score += 30;
  else if (title.split(/\s+/).some((w) => w.startsWith(q))) score += 20;
  else if (title.includes(q)) score += 8;

  for (const tag of artifact.tags) {
    const t = tag.toLowerCase();
    if (t.startsWith(q)) score += 15;
    else if (t.includes(q)) score += 6;
  }

  if (artifact.description.toLowerCase().includes(q)) score += 3;

  return score;
}
