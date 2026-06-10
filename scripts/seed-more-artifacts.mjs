#!/usr/bin/env node
/**
 * Publish sample artifacts from samples/artifacts/ (see samples/manifest.json).
 *
 * Usage:
 *   npm run seed:more
 *   API_URL=https://ezra-test-web.vercel.app npm run seed:more
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SAMPLES_DIR = path.join(ROOT, "samples", "artifacts");
const MANIFEST_PATH = path.join(ROOT, "samples", "manifest.json");
const API_URL = process.env.API_URL ?? "http://localhost:3000";

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

async function publishEntry(entry) {
  const filePath = path.join(SAMPLES_DIR, entry.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${entry.file}`);
  }

  const buffer = fs.readFileSync(filePath);
  const mime = entry.file.endsWith(".pdf")
    ? "application/pdf"
    : entry.file.endsWith(".png")
      ? "image/png"
      : "text/html";

  const blob = new Blob([buffer], { type: mime });
  const file = new File([blob], entry.file, { type: mime });
  const form = new FormData();
  form.append("file", file);
  form.append("title", entry.title);
  form.append("description", entry.description);
  form.append("tags", entry.tags.join(","));

  const res = await fetch(`${API_URL}/api/artifacts`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.artifact;
}

async function main() {
  console.log(`Publishing ${manifest.length} samples → ${API_URL}\n`);

  try {
    const health = await fetch(`${API_URL}/api/artifacts`);
    if (!health.ok) throw new Error(`API ${health.status}`);
  } catch (e) {
    console.error("Start the app or set API_URL to production.");
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  let ok = 0;
  for (const entry of manifest) {
    process.stdout.write(`  • ${entry.title} … `);
    try {
      const artifact = await publishEntry(entry);
      console.log(`✓ ${artifact.id.slice(0, 8)}…`);
      ok++;
    } catch (e) {
      console.log(`✗ ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nPublished ${ok}/${manifest.length}. Run: npm run index`);
  console.log(`Gallery: ${API_URL}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
