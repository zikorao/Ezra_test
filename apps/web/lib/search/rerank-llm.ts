import type { Artifact } from "../types";
import { isLlmAvailable } from "../llm";
import { withLlmTiming } from "../observability/log";
import { orderArtifactsByIds } from "./rrf";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

async function groqRerankChat(system: string, user: string): Promise<string> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new Error("GROQ_API_KEY is not configured.");
  const modelName = process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";

  return withLlmTiming("search.rerank", "groq", modelName, system.length + user.length, async () => {
    const res = await fetch(GROQ_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Groq rerank ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  });
}

/** Re-order hybrid search hits using Groq (works on Vercel without Jina). */
export async function rerankWithLlm(
  query: string,
  artifacts: Artifact[],
  limit = 20,
): Promise<Artifact[]> {
  if (artifacts.length <= 1) return artifacts;
  if (!(await isLlmAvailable())) return artifacts.slice(0, limit);

  const candidates = artifacts.slice(0, 15);
  const lines = candidates.map(
    (a, i) =>
      `${i + 1}. ${a.title} | ${a.description.slice(0, 100)} | tags: ${a.tags.join(", ")}`,
  );

  const system = `You rerank catalog search results for AI-generated deliverables (mockups, decks, docs, images).
Respond with JSON only: {"order":[1,3,2,...]} — candidate numbers most relevant first.
Omit numbers that do not match the query intent.`;

  try {
    const raw = await groqRerankChat(
      system,
      `Query: ${query}\n\nCandidates:\n${lines.join("\n")}`,
    );
    const parsed = JSON.parse(raw) as { order?: number[] };
    if (!Array.isArray(parsed.order) || parsed.order.length === 0) {
      return artifacts.slice(0, limit);
    }

    const orderedIds = parsed.order
      .map((n) => candidates[n - 1]?.id)
      .filter((id): id is string => Boolean(id));

    const reranked = orderArtifactsByIds(candidates, orderedIds);
    const seen = new Set(reranked.map((a) => a.id));
    for (const a of candidates) {
      if (!seen.has(a.id)) reranked.push(a);
    }

    return [...reranked, ...artifacts.slice(candidates.length)].slice(0, limit);
  } catch {
    return artifacts.slice(0, limit);
  }
}
