const JINA_API = "https://api.jina.ai/v1/embeddings";
const DEFAULT_MODEL = "jina-embeddings-v3";

function apiKey(): string | null {
  const key = process.env.JINA_API_KEY?.trim();
  return key || null;
}

function model(): string {
  return process.env.JINA_EMBED_MODEL?.trim() || DEFAULT_MODEL;
}

export async function isJinaAvailable(): Promise<boolean> {
  return Boolean(apiKey());
}

export async function embedJina(
  text: string,
  task: "retrieval.query" | "retrieval.passage",
): Promise<number[]> {
  const key = apiKey();
  if (!key) throw new Error("JINA_API_KEY is not configured.");

  const res = await fetch(JINA_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model(),
      task,
      dimensions: 768,
      input: [text],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jina embeddings ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("Jina returned empty embedding.");
  }
  return embedding;
}
