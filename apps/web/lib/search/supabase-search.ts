import { createAdminClient } from "../supabase/admin";
import type { Artifact } from "../types";

export async function vectorSearchArtifacts(
  embedding: number[],
  matchCount = 30,
  threshold = 0.22,
): Promise<Artifact[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_artifacts", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: matchCount,
  });

  if (error) {
    if (error.message.includes("match_artifacts")) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as Artifact[];
}

export async function ftsSearchArtifacts(
  queryText: string,
  matchCount = 30,
): Promise<Artifact[]> {
  const supabase = createAdminClient();

  const { data: tsData, error: tsError } = await supabase
    .from("artifacts")
    .select("*")
    .textSearch("search_vector", queryText, {
      type: "websearch",
      config: "english",
    })
    .limit(matchCount);

  if (!tsError && tsData?.length) {
    return tsData as Artifact[];
  }

  if (tsError && !tsError.message.includes("search_vector")) {
    // Column missing — try RPC or fallback below
    if (!tsError.message.includes("does not exist")) {
      throw new Error(tsError.message);
    }
  }

  const { data, error } = await supabase.rpc("search_artifacts_fts", {
    query_text: queryText,
    match_count: matchCount,
  });

  if (!error && data?.length) {
    return data as Artifact[];
  }

  if (
    error &&
    !error.message.includes("search_artifacts_fts") &&
    !error.message.includes("search_vector")
  ) {
    throw new Error(error.message);
  }

  return textSearchArtifactsFallback(queryText);
}

/** Fallback when migration 003 is not applied yet. */
export async function textSearchArtifactsFallback(
  queryText: string,
): Promise<Artifact[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const q = queryText.toLowerCase();
  return ((data ?? []) as Artifact[]).filter((artifact) => {
    const haystack = [
      artifact.title,
      artifact.description,
      artifact.content_text,
      ...artifact.tags,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
