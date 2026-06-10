const DEFAULT_BASE = "http://localhost:11434";
const DEFAULT_MODEL = "nomic-embed-text";

function baseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE;
}

function model(): string {
  return process.env.OLLAMA_EMBED_MODEL?.trim() || DEFAULT_MODEL;
}

export async function isOllamaEmbeddingAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function embedOllama(text: string): Promise<number[]> {
  const res = await fetch(`${baseUrl()}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: model(), prompt: text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama embeddings ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { embedding?: number[] };
  if (!data.embedding?.length) {
    throw new Error("Ollama returned empty embedding.");
  }
  return data.embedding;
}
