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

### Vercel deployment

Root directory: `apps/web`. Set these environment variables in the Vercel dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (your Vercel URL)
- `ARTIFACT_HUB_API_KEY` (for MCP — `npm run api-key`)
- `LLM_PROVIDER=groq` + `GROQ_API_KEY` (production LLM — get a free key at [console.groq.com](https://console.groq.com))
- `GROQ_MODEL` (optional, default `llama-3.1-8b-instant`)
- `OLLAMA_BASE_URL` / `OLLAMA_MODEL` (local dev only)

```bash
npx vercel --cwd apps/web
```

MCP config: see `docs/claude-desktop-config.json`.

### Ollama (Step 1)

- **Server:** `http://localhost:11434`
- **Models:** `llama3.2:latest` (default Llama), `mistral:latest`, `gemma2:2b`
- **CLI:** `~/bin/ollama` (or `open -a Ollama` to start)
