# Artifact Hub — Round 2 Writeup

**Live demo:** [https://ezra-test-web.vercel.app](https://ezra-test-web.vercel.app)  
**Repo:** [github.com/zikorao/Ezra_test](https://github.com/zikorao/Ezra_test) (branch: `main`)

---

## What I built and why

Artifact Hub is a lightweight platform for the full lifecycle of AI-generated deliverables: **publish → browse → share → review**. Teams already produce HTML mockups, PDF reports, and images with Claude, Gamma, Midjourney, etc., but those files end up in blob storage with expiring Slack links and scattered feedback. Artifact Hub makes the catalog browsable and gives reviewers a single place to comment.

### Product decisions

| Decision | Rationale |
|----------|-----------|
| **Gallery-first home page** | Non-technical reviewers should see what's available without reading docs |
| **Publish form with drag-and-drop** | Matches how people already work — drop a file, add context, ship |
| **Time-limited share links** (`/s/[token]`) | Solves the expiring-URL problem with explicit expiry (1d / 7d / 30d / never) |
| **Threaded feedback on artifact + share views** | Feedback stays attached to the artifact, not lost in Slack |
| **MCP server for Claude Desktop** | Lets power users publish, search, and review conversationally |
| **Invisible LLM on publish + search** | Auto-metadata and NL search help without making "AI" the headline |
| **Hybrid search with LLM-first ranking** | Natural queries like *"checkout mockups from Claude"* need semantic + keyword retrieval, not exact string match |
| **Autocomplete as backup** | Prefix/tag suggestions keep search fast when LLM is slow or unavailable |

### Core flows shipped

1. **Publish** — Upload HTML, PNG, JPG, WebP, or PDF with title, description, tags; Groq/Ollama suggests metadata on drop
2. **Browse** — Gallery with LLM-powered search and live autocomplete dropdown
3. **Share** — Generate revocable links with configurable expiry
4. **Feedback** — Structured comments with threaded replies
5. **MCP** — Six tools for conversational artifact management
6. **Hybrid search** — FTS + pgvector + Groq query planning, reranking, and prefix fallback

---

## What I chose not to build (and why)

| Skipped | Why |
|---------|-----|
| **Org / RBAC / SSO** | 2-day scope; URL expiry + API key auth covers the challenge minimum |
| **Version history** | Adds UI and storage complexity; tags + metadata sufficient for MVP |
| **Feedback summarization** | Valuable but secondary to getting the core loop live |
| **Real-time collaboration** | Polling/refresh is enough for async review workflows |
| **Multi-tenant billing** | Out of scope for an internal team tool prototype |

A polished core loop beats a sprawling partial system.

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Next.js 16 (apps/web) — Vercel                                         │
│  Gallery · Publish · Share · About · REST API · /api/search/suggest     │
└──────────────┬───────────────────────────────┬──────────────────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐   ┌───────────────────────────────────────┐
│  Supabase                    │   │  AI services (pluggable providers)    │
│  Postgres                    │   │  LLM: Ollama (dev) · Groq (prod)      │
│  · artifacts + search_vector │   │  Embeddings: Ollama nomic (dev)       │
│  · embedding vector(768)     │   │            · Jina (prod / Vercel)     │
│  · HNSW index (pgvector)     │   └───────────────────────────────────────┘
│  · share_links, feedback     │
│  Storage (private bucket)    │
└──────────────────────────────┘
               ▲
               │ HTTPS + X-API-Key
┌──────────────┴──────────────┐
│  MCP server (stdio)         │
│  packages/mcp-server        │
│  Claude Desktop / MCP clients│
└─────────────────────────────┘
```

### Search pipeline (production)

```
User query
    │
    ▼
Groq planSearchQuery ──► keywords · semanticQuery · tags
    │
    ├──► Supabase FTS (tsvector + websearch)
    ├──► Jina query embedding ──► pgvector RPC (match_artifacts)
    └──► Tag hint boost
    │
    ▼
Reciprocal rank fusion (RRF) + prefix scoring
    │
    ▼
Groq rerank (top candidates)
    │
    ▼
Autocomplete backup if weak/empty results
```

**Autocomplete** (`GET /api/search/suggest`): Groq picks catalog matches from partial input; prefix/tag scoring fills in when LLM times out (~900ms).

### Repo layout

| Path | Purpose |
|------|---------|
| `apps/web/` | Next.js app — UI, API routes, Supabase client, search/LLM modules |
| `packages/mcp-server/` | Stdio MCP server calling hosted API |
| `supabase/migrations/` | Schema, storage bucket, hybrid search (003) |
| `samples/` | Demo artifact library + manifest for seeding |
| `scripts/` | Seed, index backfill, API key, Vercel deploy |

### Data model

- **artifacts** — metadata, tags, mime type, storage path, `content_text`, `search_vector` (tsvector), `embedding` (vector 768)
- **share_links** — token, expiry, artifact FK
- **feedback** — body, author, optional parent for threading

Storage files live in a private Supabase bucket; signed URLs serve previews and downloads.

---

## MCP integration

The MCP server runs locally via stdio and talks to the **hosted** Artifact Hub API (no local app required for reviewers who only use Claude Desktop).

### Setup (reviewer)

1. Copy `docs/claude-desktop-config.json` into Claude Desktop MCP settings
2. Set `ARTIFACT_HUB_API_KEY` to the value from Vercel env (or generate locally with `npm run api-key`)
3. Restart Claude Desktop

### Tools (6)

| Tool | What it does |
|------|--------------|
| `publish_artifact` | Upload a local file; optional share link with expiry |
| `search_artifacts` | Natural-language catalog search (same hybrid pipeline as web) |
| `list_artifacts` | Recent artifacts |
| `get_artifact` | Full detail + feedback + share links |
| `create_share_link` | New time-limited URL for an artifact |
| `add_feedback` | Leave structured review comments |

### API layer

MCP routes under `/api/mcp/*` authenticate with `X-API-Key` / `Authorization: Bearer`. The stdio server is a thin client — business logic stays in the Next.js app so web and MCP share one codebase.

---

## LLM usage (where and why)

LLM features are **assistive**, not decorative:

1. **Auto-metadata on publish** — Groq/Ollama analyzes extracted text and suggests title, description, and tags. Users can edit before submitting; server-side merge fills gaps if fields are empty.
2. **Search query planning** — Groq expands natural-language queries into keywords, a semantic rewrite (for vector search), and likely catalog tags.
3. **Search reranking** — Groq re-orders hybrid retrieval candidates so intent wins over raw FTS/vector scores.
4. **Autocomplete** — Groq suggests artifacts and expanded terms while the user is still typing; prefix matching is the fallback.

Both LLM and embeddings use pluggable providers (`apps/web/lib/llm/`, `apps/web/lib/embeddings/`):

| Capability | Local dev | Production (Vercel) |
|------------|-----------|---------------------|
| Metadata + search LLM | Ollama (`llama3.2`) | Groq (`LLM_PROVIDER=groq`, `GROQ_API_KEY`) |
| Vector embeddings | Ollama `nomic-embed-text` | Jina (`EMBEDDING_PROVIDER=jina`, `JINA_API_KEY`) |
| Full-text search | Supabase `search_vector` | Same |

If no LLM is available, publish and keyword/prefix search still work — metadata falls back to filename heuristics and autocomplete uses title/tag prefix matching.

### Indexing embeddings

Run migration `003_hybrid_search.sql`, then backfill:

```bash
npm run migrate:search   # prints SQL or applies via Supabase CLI
npm run index            # embed + FTS index all artifacts
npm run index:force      # re-embed everything
```

Artifacts are re-indexed on publish automatically when embeddings are configured.

---

## Deployment

| Item | Detail |
|------|--------|
| **Host** | Vercel (free tier) |
| **URL** | [https://ezra-test-web.vercel.app](https://ezra-test-web.vercel.app) |
| **Root directory** | `apps/web` |
| **Build** | Monorepo install from repo root; Tailwind v4 native binaries installed for Linux in `vercel.json` |
| **Secrets** | Supabase URL/keys, `ARTIFACT_HUB_API_KEY`, `NEXT_PUBLIC_APP_URL`, `GROQ_API_KEY`, `JINA_API_KEY` |

Production env (minimum for full search):

```
LLM_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
EMBEDDING_PROVIDER=jina
JINA_API_KEY=...
```

Redeploy: `./scripts/deploy-vercel.sh` or `npx vercel deploy --prod` from `apps/web`.

---

## Walkthrough (written)

### 1. Browse the gallery

Open [https://ezra-test-web.vercel.app](https://ezra-test-web.vercel.app). You should see seeded artifacts (mockups, reports, HTML demos). Type a few letters in search — e.g. `che` — and pick an autocomplete suggestion, or submit queries like *"checkout mockups from Claude"* or *"investor pitch deck"*.

### 2. Publish an artifact

1. Click **Publish**
2. Drop an HTML, PNG, or PDF file
3. Wait for suggested title/tags (Groq on Vercel; Ollama locally)
4. Submit — you're redirected to the artifact detail page with preview; embedding is indexed in the background

### 3. Share with expiry

On an artifact detail page, create a share link (1d / 7d / 30d / never). Open the `/s/[token]` URL in an incognito window — reviewers see preview + feedback without full gallery access.

### 4. Leave feedback

On artifact or share pages, add a comment. Reply to existing threads to simulate async design review.

### 5. MCP (Claude Desktop)

Configure MCP per `docs/claude-desktop-config.json`, then in Claude:

> "Search Artifact Hub for checkout mockups"  
> "Publish `/path/to/mockup.html` titled 'Checkout v2' and create a 7-day share link"  
> "Add feedback on artifact [id]: the CTA contrast is too low"

---

## AI tools used in this project

| Tool | Used for |
|------|----------|
| **Cursor** | Primary IDE agent — scaffolding, features, Supabase wiring, MCP server, hybrid search, Vercel deploy |
| **Ollama** | Local LLM + embeddings during development |
| **Groq** | Production LLM for metadata, search planning, reranking |
| **Jina** | Production vector embeddings for pgvector semantic search |
| **Claude Desktop + MCP** | End-to-end conversational workflow testing |

---

## What I'd do with another week

1. **Feedback digest** — LLM summary across reviewers for artifact owners
2. **Search quality regression suite** — scripted queries with expected top hits
3. **GitHub → Vercel CI** — Auto-deploy `main` on push
4. **Light E2E tests** — Playwright for publish → share → feedback happy path
5. **Tune LLM suggest prompts** — Reduce false expansions on short prefixes (e.g. `inv` → investor, not inventory)

---

## Seeded demo data

```bash
npm run seed          # 5 simulated AI artifacts
npm run seed:more     # expanded sample library (19 artifacts)
npm run seed:all      # seed + feedback threads
npm run index         # backfill embeddings after seeding
```

Requires Supabase credentials in `apps/web/.env.local`.
