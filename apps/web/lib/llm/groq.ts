import type { ArtifactMetadata, MetadataInput } from "./types";
import { parseMetadataJson, parseSearchKeywordsJson } from "./parse";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";

function apiKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim();
  return key || null;
}

function model(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
}

async function groqChat(
  system: string,
  user: string,
  json = true,
): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error("GROQ_API_KEY is not configured.");

  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model(),
      temperature: 0.2,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function isGroqAvailable(): Promise<boolean> {
  const key = apiKey();
  if (!key) return false;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function generateArtifactMetadata(
  input: MetadataInput,
): Promise<ArtifactMetadata | null> {
  const excerpt = input.contentText.slice(0, 4000) || "(no extractable text)";
  const system = `You generate catalog metadata for AI-produced creative assets in a team artifact hub.
Respond with JSON only: {"title":"...","description":"...","tags":["tag1","tag2"]}
- title: concise, max 60 chars, professional
- description: 1-2 sentences, max 200 chars, what it is and who it's for
- tags: 3-5 lowercase single-word or short hyphenated tags (tool name if obvious: claude, gamma, gpt, midjourney)`;

  const user = `Filename: ${input.filename}
MIME type: ${input.mimeType}
Content excerpt:
${excerpt}`;

  const raw = await groqChat(system, user, true);
  return parseMetadataJson(raw);
}

export async function parseSearchQuery(query: string): Promise<string[]> {
  const system = `Extract search keywords from natural language queries about a catalog of AI-generated artifacts (HTML mockups, PDFs, images, decks).
Respond with JSON only: {"keywords":["word1","word2"]}
Return 1-6 lowercase keywords or short phrases. Include tool names, topics, and file types when implied.`;

  const raw = await groqChat(system, `Query: ${query}`, true);
  const keywords = parseSearchKeywordsJson(raw);
  if (keywords.length > 0) return keywords;

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
}
