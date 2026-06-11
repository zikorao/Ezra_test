export type SuggestCatalogItem = {
  index: number;
  id: string;
  title: string;
  tags: string[];
};

export type SanitizedSuggestResult = {
  artifactIds: string[];
  keywords: string[];
  tags: string[];
};

/** Tags and title words in the catalog that start with the typed prefix. */
export function catalogPrefixMatches(
  prefix: string,
  catalog: SuggestCatalogItem[],
): { tags: string[]; words: string[] } {
  const p = prefix.trim().toLowerCase();
  const tags = new Set<string>();
  const words = new Set<string>();

  for (const item of catalog) {
    for (const tag of item.tags) {
      const t = tag.toLowerCase();
      if (t.startsWith(p)) tags.add(t);
    }
    for (const word of item.title.split(/\s+/)) {
      const w = word.toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (w.startsWith(p)) words.add(w);
    }
  }

  return { tags: [...tags], words: [...words] };
}

function isAllowedTerm(
  term: string,
  prefix: string,
  allowed: Set<string>,
): boolean {
  const t = term.trim().toLowerCase();
  const p = prefix.trim().toLowerCase();
  if (!t) return false;
  if (t === p || allowed.has(t)) return true;
  if (!t.startsWith(p)) return false;
  return [...allowed].some((a) => a.startsWith(t) || t.startsWith(a));
}

/** Drop LLM hallucinations (e.g. "inventory" for prefix "inv" when catalog has "investor"). */
export function sanitizeLlmSuggestResult(
  prefix: string,
  catalog: SuggestCatalogItem[],
  result: SanitizedSuggestResult,
): SanitizedSuggestResult {
  const p = prefix.trim().toLowerCase();
  const { tags: prefixTags, words: prefixWords } = catalogPrefixMatches(
    prefix,
    catalog,
  );
  const allowed = new Set<string>([p, ...prefixTags, ...prefixWords]);

  const keywords = result.keywords.filter((kw) =>
    isAllowedTerm(kw, prefix, allowed),
  );
  const tags = result.tags.filter((tag) => isAllowedTerm(tag, prefix, allowed));

  const artifactIds = result.artifactIds.filter((id) => {
    const item = catalog.find((c) => c.id === id);
    if (!item) return false;
    const title = item.title.toLowerCase();
    const tagHit = item.tags.some((t) => t.toLowerCase().startsWith(p));
    const titleHit = title.split(/\s+/).some((w) => w.toLowerCase().startsWith(p));
    const tagMatch = tags.some((t) =>
      item.tags.some((it) => it.toLowerCase() === t),
    );
    return tagHit || titleHit || tagMatch;
  });

  return {
    artifactIds: [...new Set(artifactIds)],
    keywords: keywords.length ? keywords : prefixTags.slice(0, 2),
    tags: tags.length ? tags : prefixTags.slice(0, 3),
  };
}
