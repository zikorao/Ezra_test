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
| **Feedback digest (Groq)** | Publishers catch up on async review threads without reading every comment |
| **MCP server for Claude Desktop** | Lets power users publish, search, and review conversationally |
| **Invisible LLM on publish + search** | Auto-metadata and NL search help without making "AI" the headline |
| **Hybrid search with LLM-first ranking** | Natural queries like *"checkout mockups from Claude"* need semantic + keyword retrieval |
| **Autocomplete as backup** | Prefix/tag suggestions keep search fast when LLM is slow or unavailable |
| **Rate limits on LLM routes** | Supabase fixed-window quotas protect suggest, search, and digest from abuse |

### Core flows shipped

1. **Publish** — Upload HTML, PNG, JPG, WebP, or PDF; Groq/Ollama suggests title, description, and tags on drop
2. **Browse** — Gallery with LLM-powered search and live autocomplete dropdown
3. **Share** — Generate revocable links with configurable expiry
4. **Feedback** — Structured comments with threaded replies on artifact and share pages
5. **Feedback digest** — On-demand Groq summary: overview, themes, consensus, action items
6. **MCP** — Six tools for conversational artifact management
7. **Hybrid search** — FTS + pgvector + Groq query planning, reranking, and prefix fallback

---

## What I chose not to build (and why)

| Skipped | Why |
|---------|-----|
| **Org / RBAC / SSO** | 2-day scope; URL expiry + API key auth covers the challenge minimum |
| **Version history** | Adds UI and storage complexity; tags + metadata sufficient for MVP |
| **Real-time collaboration** | Polling/refresh is enough for async review workflows |
| **Multi-tenant billing** | Out of scope for an internal team tool prototype |

A polished core loop beats a sprawling partial system.

### Observability (layer 9 — Phoenix Cloud)

Artifact Hub exports **OpenTelemetry traces** to [Phoenix Cloud](https://app.phoenix.arize.com) (free tier) using `@arizeai/phoenix-otel`, alongside structured JSON logs on stdout.

| What | How |
|------|-----|
| **LLM spans** | `metadata.generate`, `search.plan`, `search.rerank`, `search.suggest`, `feedback.digest` — provider, model, latency, input size |
| **Pipeline spans** | `search`, `search.suggest`, `feedback.digest` chains with result metadata |
| **Phoenix UI** | Traces, latency, and span hierarchy in your Phoenix space |
| **Privacy** | Full prompts and comment bodies are not exported |
| **Serverless** | Immediate span flush after each operation (Vercel-friendly) |
| **Fallback** | If `PHOENIX_API_KEY` / endpoint unset, only JSON logs run |

```bash
PHOENIX_API_KEY=phx_...
PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/your-space-name
PHOENIX_PROJECT_NAME=artifact-hub
```

Local: `pip install arize-phoenix && phoenix serve` → `PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006`

### OpenTelemetry dashboards (layer 9b — Vercel correlation)

| What | How |
|------|-----|
| **Vercel OTEL** | `@vercel/otel` in `instrumentation.ts` — platform traces + optional drains |
| **Phoenix export** | Additional span processor via `getDefaultSpanProcessor` (same spans, dual export) |
| **Web Analytics** | `@vercel/analytics` custom events with `trace_id` from `x-trace-id` headers |
| **Structured logs** | JSON logs include `trace_id`, `span_id`, `vercel.deployment_id` |
| **Correlation** | Filter Phoenix traces, Vercel Analytics events, and function logs by shared `trace_id` |

Enable Web Analytics in the Vercel dashboard; see `docs/observability-dashboards.md`.

### Rate limiting (layer 10)

Fixed-window quotas in Supabase (`004_rate_limit.sql`) protect LLM-heavy paths by client IP (or API key for MCP search). Over-limit callers get HTTP **429** with `retry_after_seconds`. If the migration is not applied yet, checks fail open so the app keeps working.

| Route | Limit |
|-------|-------|
| `/api/search/suggest` | 60/min/IP |
| `/?q=` gallery search | 20/min/IP |
| `/api/artifacts/[id]/feedback/digest` | 5/10min/IP + 2/5min/artifact |
| `/api/mcp/artifacts?q=` | 60/min/API key |

Apply: `npm run migrate:rate-limit` — see `docs/rate-limiting.md`.

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Next.js 16 (apps/web) — Vercel                                         │
│  Gallery · Publish · Share · About · REST API                           │
│  /api/search/suggest · /api/artifacts/[id]/feedback/digest              │
└──────────────┬───────────────────────────────┬──────────────────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐   ┌───────────────────────────────────────┐
│  Supabase                    │   │  AI services (pluggable providers)    │
│  Postgres                    │   │  LLM: Ollama (dev) · Groq (prod)        │
│  · artifacts + search_vector │   │  Embeddings: Ollama nomic (dev)         │
│  · embedding vector(768)     │   │            · Jina (prod / Vercel)       │
│  · HNSW index (pgvector)     │   └───────────────────────────────────────┘
│  · share_links, feedback     │
│  · rate_limit_buckets (004)  │
│  Storage (private bucket)    │
└──────────────────────────────┘
               ▲
               │ HTTPS + X-API-Key
┌──────────────┴──────────────┐
│  MCP server (stdio)         │
│  packages/mcp-server        │
│  Claude Desktop / MCP clients│
└─────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Observability (Phoenix OTEL) │
│  Structured JSON → Vercel logs│
│  LLM + pipeline spans        │
└──────────────────────────────┘
```

### Search pipeline (production)

```
User query
    │
    ▼
Rate limit check (gallery / MCP search)
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

**Autocomplete** (`GET /api/search/suggest`): Groq picks catalog matches from partial input with catalog prefix hints; title/tag prefix scoring fills in when LLM times out (~900ms). Output is sanitized so partial queries like `inv` map to catalog terms (e.g. `investor`), not unrelated English words.

### Feedback digest pipeline

```
Artifact detail page
    │
    ▼
User clicks "Summarize feedback"
    │
    ▼
GET /api/artifacts/[id]/feedback/digest
    │
    ├──► Rate limit check (IP + per-artifact buckets)
    ├──► Load threaded comments from Supabase
    ├──► Format threads for LLM context
    └──► Groq summarizeFeedbackDigest
    │
    ▼
JSON: summary · themes · consensus · actionItems
```

On-demand only — no LLM call until the publisher requests a digest.

### Repo layout

| Path | Purpose |
|------|---------|
| `apps/web/` | Next.js app — UI, API routes, Supabase client, search/LLM/feedback modules |
| `packages/mcp-server/` | Stdio MCP server calling hosted API |
| `supabase/migrations/` | Schema (001–002), hybrid search (003), rate limits (004) |
| `samples/` | Demo artifact library + manifest for seeding |
| `scripts/` | Seed, index, migrations, observability test, Vercel deploy |
| `docs/` | MCP config, observability dashboards, rate limiting |
| `WRITEUP.md` | Round 2 submission narrative (this file) |

### Data model

- **artifacts** — metadata, tags, mime type, storage path, `content_text`, `search_vector` (tsvector), `embedding` (vector 768)
- **share_links** — token, expiry, artifact FK
- **feedback** — body, author, optional `parent_id` for threading
- **rate_limit_buckets** — fixed-window counters for LLM endpoint quotas (migration 004)

Storage files live in a private Supabase bucket; signed URLs serve previews and downloads.

---

## MCP integration

The MCP server runs locally via stdio and talks to the **hosted** Artifact Hub API (no local app required for reviewers who only use Claude Desktop).

### Setup (reviewer)

1. Copy `docs/claude-desktop-config.json` into Claude Desktop MCP settings (update paths and API key)
2. Set `ARTIFACT_HUB_API_KEY` to the value from Vercel env (or generate locally with `npm run api-key`)
3. Restart Claude Desktop

See `docs/README.md` for full MCP setup.

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

MCP routes under `/api/mcp/*` authenticate with `X-API-Key` / `Authorization: Bearer`. Search queries are rate-limited per API key (60/min default). The stdio server is a thin client — business logic stays in the Next.js app so web and MCP share one codebase.

---

## LLM usage (where and why)

LLM features are **assistive**, not decorative:

| Feature | When it runs | Provider |
|---------|--------------|----------|
| **Auto-metadata** | File dropped on publish form | Groq / Ollama |
| **Search query planning** | Gallery search submitted | Groq / Ollama |
| **Search reranking** | After hybrid retrieval | Groq / Ollama |
| **Autocomplete suggest** | User typing in search bar | Groq / Ollama |
| **Feedback digest** | Publisher clicks "Summarize feedback" | Groq / Ollama |

Pluggable modules: `apps/web/lib/llm/`, `apps/web/lib/embeddings/`.

| Capability | Local dev | Production (Vercel) |
|------------|-----------|---------------------|
| Metadata + search + digest LLM | Ollama (`llama3.2`) | Groq (`LLM_PROVIDER=groq`, `GROQ_API_KEY`) |
| Vector embeddings | Ollama `nomic-embed-text` | Jina (`EMBEDDING_PROVIDER=jina`, `JINA_API_KEY`) |
| Full-text search | Supabase `search_vector` | Same |

If no LLM is available, publish and keyword/prefix search still work — metadata falls back to filename heuristics; digest shows a friendly error.

### Indexing embeddings

Run migrations `001`–`004`, then backfill:

```bash
npm run migrate:search      # migration 003
npm run migrate:rate-limit  # migration 004
npm run index               # embed + FTS index all artifacts
npm run index:force         # re-embed everything
```

Artifacts are re-indexed on publish automatically when embeddings are configured.

---

## Deployment

| Item | Detail |
|------|--------|
| **Host** | Vercel (free tier) |
| **URL** | [https://ezra-test-web.vercel.app](https://ezra-test-web.vercel.app) |
| **Root directory** | `apps/web` |
| **Branch** | `main` (auto-deploy on push) |
| **Build** | Monorepo install from repo root; Tailwind v4 native binaries for Linux in `vercel.json` |
| **Secrets** | Supabase URL/keys, `ARTIFACT_HUB_API_KEY`, `NEXT_PUBLIC_APP_URL`, `GROQ_API_KEY`, `JINA_API_KEY`, `PHOENIX_API_KEY`, `PHOENIX_COLLECTOR_ENDPOINT` |

Production env (minimum for full search + digest):

```
LLM_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
EMBEDDING_PROVIDER=jina
JINA_API_KEY=...
PHOENIX_API_KEY=...
PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/your-space-name
PHOENIX_PROJECT_NAME=artifact-hub
```

Redeploy: `./scripts/deploy-vercel.sh` or `npx vercel deploy --prod` from `apps/web`.

---

## Walkthrough (written)

### 1. Browse the gallery

Open [https://ezra-test-web.vercel.app](https://ezra-test-web.vercel.app). The gallery includes seeded artifacts with realistic review threads. Type a few letters in search — e.g. `che` or `inv` — and pick an autocomplete suggestion, or submit *"checkout mockups from Claude"* or *"investor pitch deck"*.

### 2. Publish an artifact

1. Click **Publish**
2. Drop an HTML, PNG, or PDF file
3. Wait for suggested title/tags (Groq on Vercel; Ollama locally)
4. Submit — preview on the detail page; embedding indexed in the background

### 3. Share with expiry

On an artifact detail page, create a share link (1d / 7d / 30d / never). Open `/s/[token]` in incognito — reviewers see preview + feedback without full gallery access.

### 4. Leave feedback

On artifact or share pages, add a comment and reply to threads. Production is pre-seeded with topic-specific threads (checkout, pitch deck, security runbook, etc.) via `npm run seed:feedback`.

### 5. Feedback digest

On any artifact with comments, click **Summarize feedback**. Groq returns an overview, recurring themes, reviewer consensus, and suggested action items. Click **Refresh summary** after new comments arrive.

### 6. MCP (Claude Desktop)

Configure MCP per `docs/claude-desktop-config.json`, then in Claude:

> "Search Artifact Hub for checkout mockups"  
> "Publish `/path/to/mockup.html` titled 'Checkout v2' and create a 7-day share link"  
> "Add feedback on artifact [id]: the CTA contrast is too low"

---

## AI tools used in this project

| Tool | Used for |
|------|----------|
| **Cursor** | Primary IDE agent — scaffolding, features, Supabase wiring, MCP server, hybrid search, feedback digest, Vercel deploy |
| **Ollama** | Local LLM + embeddings during development |
| **Groq** | Production LLM for metadata, search, reranking, autocomplete, feedback digest |
| **Jina** | Production vector embeddings for pgvector semantic search |
| **Claude Desktop + MCP** | End-to-end conversational workflow testing |

---

## What I'd do with another week

1. **Search quality regression suite** — scripted queries with expected top hits
2. **GitHub → Vercel CI** — lint + build gate on pull requests
3. **Light E2E tests** — Playwright for publish → share → feedback → digest happy path
4. **Digest on share view** — read-only digest for reviewers with artifact access
5. **Digest caching** — store generated summaries in Supabase to avoid repeat Groq calls

---

## Seeded demo data

Production is pre-populated. To reproduce locally or refresh:

```bash
npm run seed          # 5 core AI artifacts (checkout, deck, report, …)
npm run seed:more     # 10 sample library artifacts from samples/
npm run seed:all      # both seed scripts
npm run seed:feedback # threaded comments + replies on all artifacts
npm run seed:demo     # seed:all + seed:feedback in one command
npm run index         # backfill embeddings after seeding
```

Seed against production:

```bash
API_URL=https://ezra-test-web.vercel.app npm run seed:feedback
```

Requires Supabase credentials in `apps/web/.env.local` for artifact seeding; feedback seeding only needs a running API.

---

## API reference (key routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/artifacts` | GET, POST | List / publish artifacts |
| `/api/artifacts/[id]/feedback` | GET, POST | List / add threaded feedback |
| `/api/artifacts/[id]/feedback/digest` | GET | Groq feedback summary |
| `/api/search/suggest?q=` | GET | Autocomplete suggestions |
| `/api/mcp/*` | * | MCP-authenticated operations |
