#!/usr/bin/env node
/**
 * Smoke-test Phoenix OTEL export + optional live API triggers.
 *
 * Usage:
 *   node scripts/test-observability.mjs
 *   API_URL=https://ezra-test-web.vercel.app node scripts/test-observability.mjs --live
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, "apps/web/.env.local");
const LIVE = process.argv.includes("--live");
const API_URL = process.env.API_URL ?? "http://localhost:3000";

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return;
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 1) continue;
    const key = trimmed.slice(0, i);
    const value = trimmed.slice(i + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

async function testPhoenixExport() {
  const key = process.env.PHOENIX_API_KEY?.trim();
  const endpoint =
    process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ||
    "https://app.phoenix.arize.com";
  const project = process.env.PHOENIX_PROJECT_NAME?.trim() || "artifact-hub";

  if (!key) {
    console.log("✗ PHOENIX_API_KEY not set (check apps/web/.env.local)");
    return false;
  }

  const {
    register,
    trace,
    SpanStatusCode,
    OpenInferenceSpanKind,
    SemanticConventions,
    LLM_PROVIDER,
    LLM_MODEL_NAME,
  } = await import("@arizeai/phoenix-otel");

  const provider = register({
    projectName: project,
    url: endpoint,
    apiKey: key,
    batch: false,
  });

  const tracer = trace.getTracer("artifact-hub-test");

  await tracer.startActiveSpan("observability.smoke-test", async (chain) => {
    chain.setAttribute(
      SemanticConventions.OPENINFERENCE_SPAN_KIND,
      OpenInferenceSpanKind.CHAIN,
    );
    chain.setAttribute("test.suite", "observability");

    await tracer.startActiveSpan("search.plan", async (llm) => {
      llm.setAttribute(
        SemanticConventions.OPENINFERENCE_SPAN_KIND,
        OpenInferenceSpanKind.LLM,
      );
      llm.setAttribute(LLM_PROVIDER, "groq");
      llm.setAttribute(LLM_MODEL_NAME, "llama-3.1-8b-instant");
      llm.setAttribute("llm.operation", "search.plan");
      llm.setStatus({ code: SpanStatusCode.OK });
      llm.end();
    });

    chain.setStatus({ code: SpanStatusCode.OK });
    chain.end();
  });

  await provider.forceFlush();
  console.log(`✓ Phoenix export OK → ${endpoint} (project: ${project})`);
  return true;
}

async function triggerLiveApi() {
  console.log(`\nTriggering live API at ${API_URL} ...`);

  const suggest = await fetch(
    `${API_URL}/api/search/suggest?q=checkout`,
  ).then((r) => r.json());
  console.log(
    `  suggest: ${suggest.suggestions?.length ?? 0} items, source=${suggest.source ?? "?"}`,
  );

  const gallery = await fetch(`${API_URL}/?q=checkout`, {
    headers: { Accept: "text/html" },
  });
  console.log(`  gallery search: HTTP ${gallery.status}`);

  const artifacts = await fetch(`${API_URL}/api/artifacts`).then((r) =>
    r.json(),
  );
  const first = artifacts.artifacts?.[0];
  if (first?.id) {
    const digest = await fetch(
      `${API_URL}/api/artifacts/${first.id}/feedback/digest`,
    ).then((r) => r.json());
    console.log(
      `  feedback digest: ${digest.digest ? "generated" : digest.error ?? "no data"}`,
    );
  } else {
    console.log("  feedback digest: skipped (no artifacts)");
  }
}

loadEnvFile();

console.log("Artifact Hub — observability test\n");

let ok = false;
try {
  ok = await testPhoenixExport();
} catch (e) {
  console.log("✗ Phoenix export failed:", e instanceof Error ? e.message : e);
}

if (LIVE || process.env.LIVE === "1") {
  try {
    await triggerLiveApi();
    console.log(
      "\n→ Check traces in Phoenix UI: https://app.phoenix.arize.com",
    );
    console.log("  Project: artifact-hub");
    console.log("  Look for: observability.smoke-test, search.plan, search.suggest");
  } catch (e) {
    console.log("✗ Live API trigger failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
} else {
  console.log("\nTip: node scripts/test-observability.mjs --live");
  console.log("     API_URL=https://ezra-test-web.vercel.app node scripts/test-observability.mjs --live");
}

process.exit(ok ? 0 : 1);
