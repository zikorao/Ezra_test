# Ezra_test — Artifact Hub

**Artifact Hub** — publish, browse, review, and share AI-generated content. Built for the Round 2 challenge on top of the **$0 AI Architecture Stack** (2026 edition).

## Architecture Layers

1. **Frontend** — Next.js / Streamlit / Vercel (free tier)
2. **Agent Orchestrator** — LangGraph / crewAI
3. **RAG Pipeline** — Notion, Chroma, Qdrant (local)
4. **LLM Layer** — Ollama (Gemma 2, Llama 3.2, Mistral)
5. **Tool Use** — Model Context Protocol (MCP)
6. **Code Agent** — Aider / Claude Code CLI
7. **Data Layer** — SQLite, DuckDB, Supabase (free tier)
8. **Deployment** — Docker, Cloudflare Workers, Hugging Face
9. **Observability** — Phoenix (self-hosted)

## Reference

See `AI_Zero_cost_arc.gif` for the full architecture diagram.

## Quick start

```bash
# Install dependencies
npm install --cache .npm-cache

# Copy env template and fill in Supabase credentials
cp .env.example apps/web/.env.local

# Start the web app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/migrations/001_initial_schema.sql` in the SQL Editor
3. Create a Storage bucket named `artifacts` (private)
4. Add credentials to `apps/web/.env.local`

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

### Vercel deployment

Root directory: `apps/web`. Set these environment variables in the Vercel dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (your Vercel URL)
- `ARTIFACT_HUB_API_KEY` (for MCP — `npm run api-key`)
- `LLM_PROVIDER=groq` + `GROQ_API_KEY` (production LLM — get a free key at [console.groq.com](https://console.groq.com))
- `GROQ_MODEL` (optional, default `llama-3.1-8b-instant`)
- `EMBEDDING_PROVIDER` + `JINA_API_KEY` or `OLLAMA_EMBED_MODEL=nomic-embed-text` (semantic search)
- `OLLAMA_BASE_URL` / `OLLAMA_MODEL` (local dev only)

```bash
npx vercel --cwd apps/web
```

MCP config: see `docs/claude-desktop-config.json`.

### Hybrid search (FTS + pgvector)

1. Run migration in [Supabase SQL Editor](https://supabase.com/dashboard/project/hseydaybbuhthlxrvvlo/sql/new):
   ```bash
   npm run migrate:search   # prints SQL if CLI token not set
   ```
   Paste contents of `supabase/migrations/003_hybrid_search.sql`.

2. **Local embeddings:** `ollama pull nomic-embed-text`

3. **Index existing artifacts:**
   ```bash
   npm run index
   ```

Search combines **full-text (tsvector)**, **semantic (pgvector HNSW)**, and **LLM keyword expansion** via reciprocal rank fusion.

**Production (Vercel):** set `EMBEDDING_PROVIDER=jina` and a free [Jina API key](https://jina.ai) for vector search, or rely on FTS + keywords without embeddings.

### LLM-first search + autocomplete (Steps 8–9)

**Main search** (`/?q=...`):

1. **Groq query plan** — expands the query into keywords, a semantic rewrite (for Jina/pgvector), and likely catalog tags
2. **Hybrid retrieval** — Supabase FTS + vector RPC + tag hints, merged with reciprocal rank fusion (RRF)
3. **Groq rerank** — re-orders top candidates by intent
4. **Prefix backup** — if results are weak or empty, falls back to title/tag prefix matching

**Autocomplete** (`GET /api/search/suggest?q=...`, gallery search bar):

1. **Groq suggest** — picks catalog artifacts/tags from partial input (e.g. `inv` → `investor`, pitch deck); catalog prefix hints prevent unrelated expansions
2. **Prefix fallback** — title/tag prefix scoring when LLM is slow or unavailable (~900ms timeout)
3. Response includes `source: "llm" | "autocomplete"` for debugging

Requires `LLM_PROVIDER=groq` + `GROQ_API_KEY` on Vercel. Local dev uses Ollama for the same flow.

```bash
# Re-index after seeding or schema changes
npm run index
```

### Ollama (Step 1)

- **Server:** `http://localhost:11434`
- **Models:** `llama3.2:latest` (default Llama), `mistral:latest`, `gemma2:2b`
- **CLI:** `~/bin/ollama` (or `open -a Ollama` to start)
