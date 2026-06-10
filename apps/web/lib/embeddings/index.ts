import * as jina from "./jina";
import * as ollama from "./ollama";
import * as openai from "./openai";
import type { EmbeddingProviderName, EmbeddingTask } from "./types";

export { EMBEDDING_DIMENSIONS } from "./types";
export type { EmbeddingProviderName, EmbeddingTask };

function configuredProvider(): EmbeddingProviderName {
  const explicit = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (explicit === "none") return "none";
  if (explicit === "jina" && process.env.JINA_API_KEY?.trim()) return "jina";
  if (explicit === "openai" && process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (explicit === "ollama") return "ollama";
  if (process.env.JINA_API_KEY?.trim()) return "jina";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return "ollama";
}

export function getEmbeddingProvider(): EmbeddingProviderName {
  return configuredProvider();
}

export async function isEmbeddingAvailable(): Promise<boolean> {
  const provider = configuredProvider();
  if (provider === "none") return false;
  if (provider === "jina") return jina.isJinaAvailable();
  if (provider === "openai") return openai.isOpenAiEmbeddingAvailable();
  return ollama.isOllamaEmbeddingAvailable();
}

export async function embedText(
  text: string,
  task: EmbeddingTask = "document",
): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const provider = configuredProvider();
  if (provider === "none") return null;

  try {
    if (provider === "jina") {
      return await jina.embedJina(
        trimmed,
        task === "query" ? "retrieval.query" : "retrieval.passage",
      );
    }
    if (provider === "openai") {
      return await openai.embedOpenAi(trimmed);
    }
    if (provider === "ollama") {
      if (!(await ollama.isOllamaEmbeddingAvailable())) return null;
      return await ollama.embedOllama(trimmed);
    }
  } catch {
    return null;
  }

  return null;
}

/** Text blob used for vector indexing (title, tags, description, content). */
export function buildEmbeddingDocument(input: {
  title: string;
  description: string;
  tags: string[];
  contentText: string;
}): string {
  const tags = input.tags.length ? `Tags: ${input.tags.join(", ")}` : "";
  const content = input.contentText.slice(0, 8000);
  return [input.title, input.description, tags, content].filter(Boolean).join("\n");
}
