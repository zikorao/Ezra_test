import { titleFromFilename } from "../artifacts/text";
import * as groq from "./groq";
import * as ollama from "./ollama";
import type { ArtifactMetadata, MetadataInput } from "./types";

export type { ArtifactMetadata, MetadataInput };

function useGroq(): boolean {
  return (
    process.env.LLM_PROVIDER?.trim().toLowerCase() === "groq" &&
    Boolean(process.env.GROQ_API_KEY?.trim())
  );
}

export async function isLlmAvailable(): Promise<boolean> {
  return useGroq() ? groq.isGroqAvailable() : ollama.isOllamaAvailable();
}

export { isOllamaAvailable } from "./ollama";

export async function parseSearchQuery(query: string): Promise<string[]> {
  return useGroq()
    ? groq.parseSearchQuery(query)
    : ollama.parseSearchQuery(query);
}

export async function suggestMetadata(
  input: MetadataInput,
): Promise<ArtifactMetadata> {
  const fallbackTitle = titleFromFilename(input.filename) || "Untitled artifact";
  const llm = useGroq() ? groq : ollama;

  try {
    const available = useGroq()
      ? await groq.isGroqAvailable()
      : await ollama.isOllamaAvailable();

    if (!available) {
      return { title: fallbackTitle, description: "", tags: [] };
    }

    const generated = await llm.generateArtifactMetadata(input);
    if (!generated) {
      return { title: fallbackTitle, description: "", tags: [] };
    }

    return {
      title: generated.title || fallbackTitle,
      description: generated.description,
      tags: generated.tags,
    };
  } catch {
    return { title: fallbackTitle, description: "", tags: [] };
  }
}

/** Fill in missing fields from AI; user-provided values win. */
export function mergeMetadata(
  user: { title?: string; description?: string; tags?: string },
  ai: ArtifactMetadata,
): { title: string; description: string; tags: string } {
  const title = user.title?.trim() || ai.title;
  const description = user.description?.trim() || ai.description;
  const userTags = user.tags?.trim();
  const tags =
    userTags ||
    ai.tags.join(", ") ||
    "";

  return { title, description, tags };
}
