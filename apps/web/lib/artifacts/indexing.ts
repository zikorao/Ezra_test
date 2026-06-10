import { createAdminClient } from "../supabase/admin";
import type { Artifact } from "../types";
import {
  buildEmbeddingDocument,
  embedText,
  isEmbeddingAvailable,
} from "../embeddings";

export async function indexArtifactEmbedding(
  artifact: Pick<
    Artifact,
    "id" | "title" | "description" | "tags" | "content_text"
  >,
): Promise<boolean> {
  if (!(await isEmbeddingAvailable())) return false;

  const document = buildEmbeddingDocument({
    title: artifact.title,
    description: artifact.description,
    tags: artifact.tags,
    contentText: artifact.content_text,
  });

  const embedding = await embedText(document, "document");
  if (!embedding) return false;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("artifacts")
    .update({ embedding })
    .eq("id", artifact.id);

  if (error) {
    if (error.message.includes("vector") || error.message.includes("768")) {
      return false;
    }
    throw new Error(error.message);
  }

  return true;
}

export async function indexArtifactById(id: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("id, title, description, tags, content_text")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return false;

  return indexArtifactEmbedding(data as Artifact);
}
