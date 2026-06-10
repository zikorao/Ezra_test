import type { ArtifactMetadata, MetadataInput } from "./types";
import { parseMetadataJson, parseSearchPlanJson, parseSuggestJson } from "./parse";

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
  const plan = await planSearchQuery(query);
  return plan.keywords;
}

export type SearchPlan = {
  keywords: string[];
  semanticQuery: string;
  tags: string[];
};

export async function planSearchQuery(query: string): Promise<SearchPlan> {
  const fallbackTokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const system = `You improve search for a catalog of AI-generated artifacts.
Respond with JSON only: {"keywords":["..."],"semanticQuery":"...","tags":["..."]}`;

  try {
    const raw = await ollamaChat(system, `Query: ${query}`, true);
    const plan = parseSearchPlanJson(raw);
    if (plan) {
      return {
        keywords: plan.keywords.length
          ? plan.keywords
          : fallbackTokens.filter((w) => w.length > 1),
        semanticQuery: plan.semanticQuery || query.trim(),
        tags: plan.tags,
      };
    }
  } catch {
    // fall through
  }

  return {
    keywords: fallbackTokens.filter((w) => w.length > 1),
    semanticQuery: query.trim(),
    tags: [],
  };
}

export type LlmSuggestInput = {
  index: number;
  id: string;
  title: string;
  tags: string[];
};

export type LlmSuggestResult = {
  artifactIds: string[];
  keywords: string[];
  tags: string[];
};

export async function suggestFromPartialQuery(
  prefix: string,
  catalog: LlmSuggestInput[],
): Promise<LlmSuggestResult | null> {
  if (!catalog.length) return null;

  const lines = catalog.map(
    (item) =>
      `${item.index}. ${item.title} | tags: ${item.tags.slice(0, 6).join(", ") || "none"}`,
  );

  const system = `Autocomplete for artifact catalog. JSON: {"artifacts":[1],"keywords":[],"tags":[]}`;

  try {
    const raw = await ollamaChat(
      system,
      `Partial query: ${prefix}\n\nCatalog:\n${lines.join("\n")}`,
      true,
    );
    const parsed = parseSuggestJson(raw);
    if (!parsed) return null;

    const artifactIds = parsed.artifactIndexes
      .map((n) => catalog[n - 1]?.id)
      .filter((id): id is string => Boolean(id));

    return {
      artifactIds: [...new Set(artifactIds)],
      keywords: parsed.keywords,
      tags: parsed.tags,
    };
  } catch {
    return null;
  }
}
