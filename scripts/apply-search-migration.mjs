#!/usr/bin/env node
/**
 * Apply migration 003 via Supabase SQL API (requires SUPABASE_ACCESS_TOKEN)
 * or print instructions for manual SQL Editor run.
 *
 * Usage:
 *   node scripts/apply-search-migration.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SQL_PATH = path.join(ROOT, "supabase/migrations/003_hybrid_search.sql");
const ENV_PATH = path.join(ROOT, "apps/web/.env.local");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
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

const sql = fs.readFileSync(SQL_PATH, "utf8");
const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
  /https:\/\/([^.]+)\.supabase\.co/,
)?.[1];
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!accessToken || !projectRef) {
  console.log(
    "Run this SQL in Supabase Dashboard → SQL Editor:\n",
    `https://supabase.com/dashboard/project/${projectRef ?? "_"}/sql/new\n`,
  );
  console.log(sql);
  process.exit(0);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

if (!res.ok) {
  const body = await res.text();
  console.error("Migration API failed:", res.status, body.slice(0, 500));
  console.log("\nFallback: paste supabase/migrations/003_hybrid_search.sql in SQL Editor.");
  process.exit(1);
}

console.log("Migration 003 applied successfully.");
