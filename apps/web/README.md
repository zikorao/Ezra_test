# Artifact Hub — Web App

Next.js 16 app for the Artifact Hub platform. Deployed to Vercel with root directory `apps/web`.

**Live:** [ezra-test-web.vercel.app](https://ezra-test-web.vercel.app)

## Development

From the **repo root**:

```bash
cp .env.example apps/web/.env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` from the repo root to `apps/web/.env.local`. Minimum for core features:

- Supabase URL + anon key + service role key
- `ARTIFACT_HUB_API_KEY` (generate: `npm run api-key` from repo root)

For full AI features locally:

- `LLM_PROVIDER=ollama` + running Ollama (`llama3.2`)
- `EMBEDDING_PROVIDER=ollama` + `ollama pull nomic-embed-text`

For production parity, use Groq + Jina (see root `README.md`).

## Key pages

| Route | Purpose |
|-------|---------|
| `/` | Gallery + hybrid search + autocomplete |
| `/publish` | Upload artifacts with LLM metadata suggestions |
| `/artifacts/[id]` | Preview, share links, feedback, **feedback digest** |
| `/s/[token]` | Share link view (preview + feedback) |
| `/about` | Project overview |

## Key API routes

| Route | Purpose |
|-------|---------|
| `GET /api/artifacts` | List artifacts |
| `POST /api/artifacts` | Publish (multipart) |
| `GET/POST /api/artifacts/[id]/feedback` | Threaded feedback |
| `GET /api/artifacts/[id]/feedback/digest` | Groq feedback summary |
| `GET /api/search/suggest?q=` | Search autocomplete |
| `/api/mcp/*` | MCP-authenticated endpoints |

## Project structure

```
app/              # Next.js App Router pages + API routes
components/       # UI (gallery-search, feedback-panel, feedback-digest, …)
lib/
  artifacts/      # Publish, list, signed URLs, indexing
  feedback/       # Comments, digest generation
  llm/            # Groq + Ollama providers
  embeddings/     # Jina + Ollama + OpenAI
  search/         # Hybrid search, suggest, RRF, rerank
  observability/  # Structured JSON logging for LLM ops
  share/          # Share link tokens + expiry
  supabase/       # Admin client
```

## Build & deploy

```bash
npm run build     # from repo root
npx vercel deploy --prod   # from apps/web
```

See `vercel.json` for monorepo install command and Tailwind native binary handling.
