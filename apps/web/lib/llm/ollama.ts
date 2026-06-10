import type { ArtifactMetadata, MetadataInput } from "./types";

const DEFAULT_BASE = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2";

function baseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE;
}

function model(): string {
  return process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
}

async function ollamaChat(
  system: string,
  user: string,
  json = true,
): Promise<string> {
  const res = await fetch(`${baseUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model(),
      stream: false,
      ...(json ? { format: "json" } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.message?.content ?? "";
}

function parseMetadataJson(raw: string): ArtifactMetadata | null {
  try {
    const parsed = JSON.parse(raw) as {
      title?: string;
      description?: string;
      tags?: string[] | string;
    };

    const title = String(parsed.title ?? "").trim().slice(0, 120);
    const description = String(parsed.description ?? "").trim().slice(0, 500);
    let tags: string[] = [];

    if (Array.isArray(parsed.tags)) {
      tags = parsed.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    } else if (typeof parsed.tags === "string") {
      tags = parsed.tags.split(/[,#]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    }

    tags = [...new Set(tags)].slice(0, 8);

    if (!title && !description && tags.length === 0) return null;
    return { title, description, tags };
  } catch {
    return null;
  }
}

export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/api/tags`, { signal: AbortSignal.timeout(2000) });
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

  const raw = await ollamaChat(system, user, true);
  return parseMetadataJson(raw);
}

export async function parseSearchQuery(query: string): Promise<string[]> {
  const system = `Extract search keywords from natural language queries about a catalog of AI-generated artifacts (HTML mockups, PDFs, images, decks).
Respond with JSON only: {"keywords":["word1","word2"]}
Return 1-6 lowercase keywords or short phrases. Include tool names, topics, and file types when implied.`;

  const raw = await ollamaChat(system, `Query: ${query}`, true);

  try {
    const parsed = JSON.parse(raw) as { keywords?: string[] };
    if (Array.isArray(parsed.keywords)) {
      return parsed.keywords
        .map((k) => String(k).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);
    }
  } catch {
    // fall through
  }

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
}
