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
9. **Observability** — *(reference stack — Phoenix)*

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
| `docs/` | MCP configuration |
| `WRITEUP.md` | Round 2 submission writeup |
