import {
  isLlmAvailable,
  planSearchQuery,
  suggestFromPartialQuery,
  type LlmSuggestInput,
  type SearchPlan,
} from "../llm";
import { listArtifacts } from "../artifacts";
import type { Artifact } from "../types";
import { tokenizeQuery } from "./scoring";

function fallbackPlan(query: string): SearchPlan {
  const tokens = tokenizeQuery(query);
  return {
    keywords: tokens.filter((t) => t.length > 0),
    semanticQuery: query.trim(),
    tags: [],
  };
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), ms),
      ),
    ]);
  } catch {
    return fallback;
  }
}

/** LLM search plan with token fallback when unavailable or slow. */
export async function resolveSearchPlan(query: string): Promise<{
  plan: SearchPlan;
  source: "llm" | "fallback";
}> {
  const trimmed = query.trim();
  if (!trimmed) return { plan: fallbackPlan(""), source: "fallback" };

  if (!(await isLlmAvailable())) {
    return { plan: fallbackPlan(trimmed), source: "fallback" };
  }

  const plan = await withTimeout(
    planSearchQuery(trimmed),
    2500,
    fallbackPlan(trimmed),
  );

  const usedLlm =
    plan.keywords.some((k) => !tokenizeQuery(trimmed).includes(k)) ||
    plan.semanticQuery.toLowerCase() !== trimmed.toLowerCase() ||
    plan.tags.length > 0;

  return {
    plan: {
      keywords: [...new Set([...tokenizeQuery(trimmed), ...plan.keywords])],
      semanticQuery: plan.semanticQuery || trimmed,
      tags: plan.tags,
    },
    source: usedLlm ? "llm" : "fallback",
  };
}

function toCatalogInput(artifacts: Artifact[]): LlmSuggestInput[] {
  return artifacts.map((artifact, index) => ({
    index: index + 1,
    id: artifact.id,
    title: artifact.title,
    tags: artifact.tags,
  }));
}

/** LLM autocomplete with null when unavailable or no confident matches. */
export async function resolveLlmSuggestions(prefix: string): Promise<{
  artifactIds: string[];
  keywords: string[];
  tags: string[];
} | null> {
  const q = prefix.trim();
  if (q.length < 2) return null;
  if (!(await isLlmAvailable())) return null;

  const all = await listArtifacts();
  const catalog = toCatalogInput(all.slice(0, 40));

  const result = await withTimeout(
    suggestFromPartialQuery(q, catalog),
    900,
    null,
  );

  if (!result) return null;
  if (
    !result.artifactIds.length &&
    !result.keywords.length &&
    !result.tags.length
  ) {
    return null;
  }

  return result;
}
