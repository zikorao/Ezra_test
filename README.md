# Ezra_test — Artifact Hub

**Artifact Hub** — publish, browse, review, and share AI-generated content. Built for the Round 2 challenge on top of the **$0 AI Architecture Stack** (2026 edition).

**Live:** [ezra-test-web.vercel.app](https://ezra-test-web.vercel.app) · **Writeup:** [WRITEUP.md](./WRITEUP.md)

## Architecture Layers

1. **Frontend** — Next.js / Vercel (free tier)
2. **Agent Orchestrator** — LangGraph / crewAI *(reference stack)*
3. **RAG Pipeline** — Supabase FTS + pgvector hybrid search
4. **LLM Layer** — Ollama (local) · Groq (production)
5. **Tool Use** — Model Context Protocol (MCP)
6. **Code Agent** — Cursor
7. **Data Layer** — Supabase Postgres + Storage
8. **Deployment** — Vercel
9. **Observability** — Phoenix Cloud (OTEL) + Vercel Analytics correlation
10. **Rate limiting** — Supabase fixed-window quotas on LLM endpoints

See `AI_Zero_cost_arc.gif` for the full reference architecture diagram.

## Quick start

```bash
npm install --cache .npm-cache
cp .env.example apps/web/.env.local   # fill in Supabase + optional Groq/Jina
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations in order in the SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_storage_bucket.sql`
   - `supabase/migrations/003_hybrid_search.sql` (or `npm run migrate:search`)
   - `supabase/migrations/004_rate_limit.sql` (or `npm run migrate:rate-limit`)
3. Add credentials to `apps/web/.env.local`

### Demo data

```bash
npm run seed:demo     # artifacts + threaded feedback
npm run index         # embeddings for semantic search
```

Against production API (feedback only):

```bash
API_URL=https://ezra-test-web.vercel.app npm run seed:feedback
```

## Build progress

| Step | Feature | Status |
|------|---------|--------|
| 1 | LLM (Ollama local) | ✅ |
| 2 | Publish + Storage + Gallery | ✅ |
| 3 | Share links + Feedback | ✅ |
| 4 | LLM auto-metadata + search | ✅ |
| 5 | MCP server (Claude Desktop) | ✅ |
| 6 | Deploy (Vercel) | ✅ |
| 7 | Hybrid search (FTS + pgvector + RRF) | ✅ |
| 8 | LLM-first search (Groq plan + rerank) | ✅ |
| 9 | Autocomplete (LLM suggest + prefix fallback) | ✅ |
| 10 | Feedback digest (Groq summary) | ✅ |
| 11 | Observability (Phoenix OTEL + structured logs) | ✅ |
| 12 | OTEL dashboards (Vercel Analytics + trace correlation) | ✅ |
| 13 | Rate limiting (Supabase quotas on LLM endpoints) | ✅ |

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run seed` | Seed 5 core demo artifacts |
| `npm run seed:more` | Seed 10 samples from `samples/` |
| `npm run seed:all` | `seed` + `seed:more` |
| `npm run seed:feedback` | Threaded comments on all artifacts |
| `npm run seed:demo` | Full demo: artifacts + feedback |
| `npm run index` | Backfill FTS + vector embeddings |
| `npm run index:force` | Re-embed all artifacts |
| `npm run migrate:search` | Print/apply migration 003 |
| `npm run migrate:rate-limit` | Print/apply migration 004 |
| `npm run test:observability` | Phoenix OTEL smoke test (+ `--live` for production API) |
| `npm run api-key` | Generate `ARTIFACT_HUB_API_KEY` |
| `npm run mcp` | Start MCP stdio server |
| `./scripts/deploy-vercel.sh` | Sync env + deploy to Vercel |

## Vercel deployment

Root directory: `apps/web`. Required environment variables:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB + storage |
| `NEXT_PUBLIC_APP_URL` | Production URL |
| `ARTIFACT_HUB_API_KEY` | MCP + programmatic API |
| `LLM_PROVIDER=groq` | Production LLM |
| `GROQ_API_KEY` | Groq API key ([console.groq.com](https://console.groq.com)) |
| `GROQ_MODEL` | Optional (default `llama-3.1-8b-instant`) |
| `EMBEDDING_PROVIDER=jina` | Production embeddings |
| `JINA_API_KEY` | Jina API key ([jina.ai](https://jina.ai)) |
| `PHOENIX_API_KEY` | Phoenix Cloud API key ([app.phoenix.arize.com](https://app.phoenix.arize.com)) |
| `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix OTLP endpoint (from space Settings) |
| `PHOENIX_PROJECT_NAME` | Project name in Phoenix UI (default `artifact-hub`) |

Local-only (do not set on Vercel): `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL`.

```bash
npx vercel --cwd apps/web
# or
./scripts/deploy-vercel.sh
```

MCP setup: see [docs/README.md](./docs/README.md).

## Hybrid search (Step 7)

1. Apply migration 003 (`npm run migrate:search`)
2. Local embeddings: `ollama pull nomic-embed-text`
3. Index: `npm run index`

Combines **full-text (tsvector)**, **semantic (pgvector HNSW)**, and **LLM keyword expansion** via reciprocal rank fusion (RRF).

## LLM-first search + autocomplete (Steps 8–9)

**Main search** (`/?q=...`):

1. Groq query plan → keywords, semantic rewrite, tag hints
2. Hybrid retrieval → FTS + Jina/pgvector + tag boost → RRF merge
3. Groq rerank top candidates
4. Prefix autocomplete backup if results are weak

**Autocomplete** (`GET /api/search/suggest?q=`):

1. Groq suggest with catalog prefix hints (sanitized output)
2. Prefix/tag fallback on timeout (~900ms)
3. Response: `{ suggestions, source: "llm" | "autocomplete" }`

## Feedback digest (Step 10)

On artifact detail pages with comments, click **Summarize feedback**:

- `GET /api/artifacts/[id]/feedback/digest`
- Returns overview, themes, consensus, and action items via Groq
- On-demand only (no LLM cost until clicked)

## Observability (Step 11) — Phoenix Cloud

Artifact Hub exports **OpenTelemetry traces** to [Phoenix](https://arize.com/phoenix/) (free tier: 2 cloud instances) via `@arizeai/phoenix-otel`, plus structured JSON logs on stdout.

### Setup (Phoenix Cloud free tier)

1. Sign up at [app.phoenix.arize.com](https://app.phoenix.arize.com)
2. Open your space → **Settings** → copy **Collector Endpoint** and **API Key**
3. Add to `apps/web/.env.local` and Vercel:

```bash
PHOENIX_API_KEY=phx_...
PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/your-space-name
PHOENIX_PROJECT_NAME=artifact-hub
```

4. Redeploy, then run a search or feedback digest — traces appear in the Phoenix UI.

### Local Phoenix (optional)

```bash
pip install arize-phoenix
phoenix serve   # UI at http://localhost:6006
```

```bash
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
# PHOENIX_API_KEY not required for local
```

### What gets traced

| Span | Kind | When |
|------|------|------|
| `search.plan`, `search.rerank`, `search.suggest`, `metadata.generate`, `feedback.digest` | LLM | Each Groq/Ollama call |
| `search`, `search.suggest`, `feedback.digest` | CHAIN | End-to-end pipeline |

Prompts and comment bodies are **not** exported (privacy). Spans include provider, model, latency, and input size.

Structured JSON logs include `trace_id`, `span_id`, and `vercel.*` fields for log–trace correlation.

## Observability dashboards (Step 12) — Phoenix + Vercel Analytics

Artifact Hub registers **`@vercel/otel`** as the primary tracer (`instrumentation.ts`) and attaches a **Phoenix span processor** when `PHOENIX_API_KEY` is set. Traces flow to Vercel Observability (and optional OTEL drains) **and** Phoenix simultaneously.

**Vercel Web Analytics** (`@vercel/analytics`) and **Speed Insights** are enabled in the root layout. Custom events (`search.suggest`, `search.submit`, `feedback.digest`) include a `trace_id` property read from the `x-trace-id` response header — use it to correlate browser events with Phoenix spans and Vercel function logs.

1. Enable **Web Analytics** in the Vercel project dashboard
2. (Optional) Configure an **OpenTelemetry trace drain** under Observability
3. See [docs/observability-dashboards.md](docs/observability-dashboards.md) for the full correlation guide

## Rate limiting (Step 13)

LLM-heavy endpoints are protected with **fixed-window limits** stored in Supabase (`rate_limit_buckets`, migration `004`):

| Endpoint | Default limit |
|----------|----------------|
| `GET /api/search/suggest` | 60 / minute / IP |
| Gallery search (`/?q=`) | 20 / minute / IP |
| `GET /api/artifacts/[id]/feedback/digest` | 5 / 10 min / IP + 2 / 5 min / artifact |
| `GET /api/mcp/artifacts?q=` | 60 / minute / API key |

Apply the migration: `npm run migrate:rate-limit`

Over-limit responses return **429** with `retry_after_seconds`, `Retry-After`, and `X-RateLimit-Remaining` headers.

See [docs/rate-limiting.md](docs/rate-limiting.md) for tuning env vars and implementation details.

## Ollama (local dev)

- **Server:** `http://localhost:11434`
- **Models:** `llama3.2`, `nomic-embed-text` (embeddings)
- Start: `open -a Ollama` or `ollama serve`

## Repo layout

| Path | Purpose |
|------|---------|
| `apps/web/` | Next.js application |
| `packages/mcp-server/` | Claude Desktop MCP server |
| `supabase/migrations/` | Database schema |
| `samples/` | Demo artifact files + manifest |
| `scripts/` | Seed, index, deploy utilities |
| `docs/` | MCP, observability dashboards, rate limiting |
| `WRITEUP.md` | Round 2 submission writeup |
