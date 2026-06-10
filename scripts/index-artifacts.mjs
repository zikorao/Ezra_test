#!/usr/bin/env node
/**
 * Backfill vector embeddings for all artifacts (requires migration 003 + embedding provider).
 *
 * Usage:
 *   npm run index
 *   EMBEDDING_PROVIDER=ollama npm run index
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, "apps/web/.env.local");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error("Missing apps/web/.env.local");
    process.exit(1);
  }
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i);
    const val = trimmed.slice(i + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const restHeaders = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function restGet(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: restHeaders });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function restPatch(path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...restHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path}: ${res.status} ${await res.text()}`);
}

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

async function isOllamaUp() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function embedOllama(text) {
  const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  return data.embedding;
}

async function embedJina(text, task) {
  const apiKey = process.env.JINA_API_KEY?.trim();
  if (!apiKey) throw new Error("JINA_API_KEY missing");
  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.JINA_EMBED_MODEL ?? "jina-embeddings-v3",
      task,
      dimensions: 768,
      input: [text],
    }),
  });
  if (!res.ok) throw new Error(`Jina ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function embedOpenAi(text) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small",
      input: text,
      dimensions: 768,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

function resolveProvider() {
  const explicit = process.env.EMBEDDING_PROVIDER?.toLowerCase();
  if (explicit === "jina" && process.env.JINA_API_KEY) return "jina";
  if (explicit === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (explicit === "ollama") return "ollama";
  if (process.env.JINA_API_KEY) return "jina";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "ollama";
}

async function embed(text, task = "retrieval.passage") {
  const provider = resolveProvider();
  if (provider === "jina") return embedJina(text, task);
  if (provider === "openai") return embedOpenAi(text);
  if (!(await isOllamaUp())) {
    throw new Error(
      "Ollama not running. Start Ollama and run: ollama pull nomic-embed-text",
    );
  }
  return embedOllama(text);
}

function buildDocument(row) {
  const tags = Array.isArray(row.tags) ? row.tags.join(", ") : "";
  const content = (row.content_text ?? "").slice(0, 8000);
  return [row.title, row.description, tags ? `Tags: ${tags}` : "", content]
    .filter(Boolean)
    .join("\n");
}

const rows = await restGet(
  "artifacts?select=id,title,description,tags,content_text,embedding&order=created_at.asc",
);

console.log(`Indexing ${rows.length} artifacts (provider: ${resolveProvider()})…`);

let ok = 0;
let skip = 0;
let fail = 0;

for (const row of rows) {
  if (row.embedding && process.env.FORCE_REINDEX !== "1") {
    skip++;
    continue;
  }

  try {
    const document = buildDocument(row);
    const vector = await embed(document);
    await restPatch(`artifacts?id=eq.${row.id}`, { embedding: vector });

    console.log(`  ✓ ${row.title}`);
    ok++;
    await new Promise((r) => setTimeout(r, 150));
  } catch (e) {
    console.error(`  ✗ ${row.title}:`, e.message);
    fail++;
  }
}

console.log(`Done. indexed=${ok} skipped=${skip} failed=${fail}`);
process.exit(fail > 0 ? 1 : 0);
