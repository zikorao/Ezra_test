import type { ArtifactMetadata, MetadataInput } from "./types";
import {
  parseMetadataJson,
  parseSearchPlanJson,
  parseSuggestJson,
} from "./parse";
import {
  catalogPrefixMatches,
  sanitizeLlmSuggestResult,
} from "../search/suggest-sanitize";

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

  const system = `You improve search for a catalog of AI-generated artifacts (HTML mockups, PDFs, images, pitch decks, runbooks).
Respond with JSON only: {"keywords":["..."],"semanticQuery":"...","tags":["..."]}
- keywords: 1-8 lowercase terms/phrases that should match titles, tags, or descriptions
- semanticQuery: one concise sentence restating what the user wants (for vector search)
- tags: likely catalog tags (tool names like claude/gamma/gpt, topics like checkout/pricing)
For partial or typo queries, infer the intended topic. Keep keywords literal enough for text search.`;

  try {
    const raw = await groqChat(system, `Query: ${query}`, true);
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

  const { tags: prefixTags, words: prefixWords } = catalogPrefixMatches(
    prefix,
    catalog,
  );
  const hintLines: string[] = [];
  if (prefixTags.length) {
    hintLines.push(`Tags starting with "${prefix}": ${prefixTags.join(", ")}`);
  }
  if (prefixWords.length) {
    hintLines.push(
      `Title words starting with "${prefix}": ${prefixWords.join(", ")}`,
    );
  }

  const system = `You power autocomplete while the user is still typing a partial query in an AI artifact catalog.
Respond with JSON only: {"artifacts":[1,3],"keywords":["investor"],"tags":["investor"]}

Rules (strict):
- The user input is an INCOMPLETE prefix, not a full word. Match against catalog titles and tags only.
- Prefer title words or tags that START WITH the partial query (prefix match).
- keywords and tags MUST come from the catalog hint list or matched artifact titles/tags — never invent unrelated words.
- Do NOT expand to common English words that are not in the catalog (e.g. prefix "inv" → "investor" from catalog, NOT "inventory").
- artifacts: 1-based indexes from the catalog list with high-confidence prefix matches only.
- If nothing matches, return empty arrays — do not guess.

Example: prefix "inv" with catalog tag "investor" → keywords:["investor"], tags:["investor"], artifacts pointing at pitch/investor decks.`;

  const user = [
    `Partial query: ${prefix}`,
    hintLines.length ? `\nCatalog prefix hints:\n${hintLines.join("\n")}` : "",
    `\nCatalog:\n${lines.join("\n")}`,
  ].join("");

  try {
    const raw = await groqChat(system, user, true);
    const parsed = parseSuggestJson(raw);
    if (!parsed) return null;

    const artifactIds = parsed.artifactIndexes
      .map((n) => catalog[n - 1]?.id)
      .filter((id): id is string => Boolean(id));

    return sanitizeLlmSuggestResult(prefix, catalog, {
      artifactIds: [...new Set(artifactIds)],
      keywords: parsed.keywords,
      tags: parsed.tags,
    });
  } catch {
    return null;
  }
}
