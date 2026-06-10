import { listArtifacts } from "../artifacts";
import { scoreForSuggest } from "./scoring";

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

export async function suggestSearch(
  prefix: string,
  limit = 8,
): Promise<SearchSuggestion[]> {
  const q = prefix.trim();
  if (q.length < 2) return [];

  const lower = q.toLowerCase();
  const all = await listArtifacts();
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
      subtitle: artifact.tags.slice(0, 3).join(" · ") || artifact.description.slice(0, 60),
      href: `/artifacts/${artifact.id}`,
    });
  }

  return suggestions.slice(0, limit + 4);
}
