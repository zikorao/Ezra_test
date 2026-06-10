import { titleFromFilename } from "../artifacts/text";
import {
  generateArtifactMetadata,
  isOllamaAvailable,
  parseSearchQuery,
} from "./ollama";
import type { ArtifactMetadata, MetadataInput } from "./types";

export type { ArtifactMetadata, MetadataInput };
export { isOllamaAvailable, parseSearchQuery };

export async function suggestMetadata(
  input: MetadataInput,
): Promise<ArtifactMetadata> {
  const fallbackTitle = titleFromFilename(input.filename) || "Untitled artifact";

  try {
    if (!(await isOllamaAvailable())) {
      return { title: fallbackTitle, description: "", tags: [] };
    }

    const generated = await generateArtifactMetadata(input);
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
