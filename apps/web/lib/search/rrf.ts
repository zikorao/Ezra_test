import type { Artifact } from "../types";

const RRF_K = 60;

export function reciprocalRankFusion(
  rankedLists: string[][],
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const list of rankedLists) {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank + 1));
    });
  }

  return scores;
}

export function orderArtifactsByIds(
  artifacts: Artifact[],
  orderedIds: string[],
): Artifact[] {
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const ordered: Artifact[] = [];

  for (const id of orderedIds) {
    if (seen.has(id)) continue;
    const artifact = byId.get(id);
    if (artifact) {
      ordered.push(artifact);
      seen.add(id);
    }
  }

  return ordered;
}

export function mergeRankedArtifactLists(
  lists: Artifact[][],
): Artifact[] {
  const byId = new Map<string, Artifact>();
  const idLists: string[][] = [];

  for (const list of lists) {
    idLists.push(list.map((a) => a.id));
    for (const artifact of list) {
      byId.set(artifact.id, artifact);
    }
  }

  const scores = reciprocalRankFusion(idLists);
  const sortedIds = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  return orderArtifactsByIds([...byId.values()], sortedIds);
}
