const OPENAI_API = "https://api.openai.com/v1/embeddings";
const DEFAULT_MODEL = "text-embedding-3-small";

function apiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key || null;
}

function model(): string {
  return process.env.OPENAI_EMBED_MODEL?.trim() || DEFAULT_MODEL;
}

export async function isOpenAiEmbeddingAvailable(): Promise<boolean> {
  return Boolean(apiKey());
}

export async function embedOpenAi(text: string): Promise<number[]> {
  const key = apiKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");

  const res = await fetch(OPENAI_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model(),
      input: text,
      dimensions: 768,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("OpenAI returned empty embedding.");
  }
  return embedding;
}
