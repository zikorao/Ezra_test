# Artifact Hub — Round 2 Writeup

**Live demo:** [https://ezra-test-web.vercel.app](https://ezra-test-web.vercel.app)  
**Repo:** [github.com/zikorao/Ezra_test](https://github.com/zikorao/Ezra_test) (branch: `feature/publish-and-storage`)

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

### Core flows shipped

1. **Publish** — Upload HTML, PNG, JPG, WebP, or PDF with title, description, tags
2. **Browse** — Gallery with search; artifact detail with inline preview
3. **Share** — Generate revocable links with configurable expiry
4. **Feedback** — Structured comments with threaded replies
5. **MCP** — Six tools for conversational artifact management

---

## What I chose not to build (and why)

| Skipped | Why |
|---------|-----|
| **Org / RBAC / SSO** | 2-day scope; URL expiry + API key auth covers the challenge minimum |
| **Version history** | Adds UI and storage complexity; tags + metadata sufficient for MVP |
| **pgvector semantic search** | Schema supports embeddings; keyword + LLM query extraction ships faster and works offline with Ollama |
| **Feedback summarization** | Valuable but secondary to getting the core loop live |
| **Real-time collaboration** | Polling/refresh is enough for async review workflows |
| **Multi-tenant billing** | Out of scope for an internal team tool prototype |

A polished core loop beats a sprawling partial system.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js 16 (apps/web) — Vercel                           │
│  Gallery · Publish · Share pages · REST API routes        │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐    ┌────────────────────────────┐
│  Supabase                │    │  LLM layer                 │
│  Postgres (artifacts,    │    │  Ollama local (dev)        │
│  share_links, feedback)  │    │  Groq optional (prod)      │
│  Storage (private bucket)│    └────────────────────────────┘
└──────────────────────────┘
               ▲
               │ HTTPS + X-API-Key
┌──────────────┴──────────────┐
│  MCP server (stdio)         │
│  packages/mcp-server        │
│  Claude Desktop / MCP clients│
└─────────────────────────────┘
```

### Repo layout

| Path | Purpose |
|------|---------|
| `apps/web/` | Next.js app — UI, API routes, Supabase client |
| `packages/mcp-server/` | Stdio MCP server calling hosted API |
| `supabase/migrations/` | Schema + storage bucket |
| `scripts/` | Seed data, API key generation, Vercel deploy |

### Data model

- **artifacts** — metadata, tags, mime type, storage path, optional content text for search
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
| `search_artifacts` | Natural-language catalog search |
| `list_artifacts` | Recent artifacts |
| `get_artifact` | Full detail + feedback + share links |
| `create_share_link` | New time-limited URL for an artifact |
| `add_feedback` | Leave structured review comments |

### API layer

MCP routes under `/api/mcp/*` authenticate with `X-API-Key` / `Authorization: Bearer`. The stdio server is a thin client — business logic stays in the Next.js app so web and MCP share one codebase.

---

## LLM usage (where and why)

LLM features are **assistive**, not decorative:

1. **Auto-metadata on publish** — When a file is dropped, Ollama analyzes extracted text and suggests title, description, and tags. Users can edit before submitting; server-side merge fills gaps if fields are empty.
2. **Natural language search** — Queries like *"checkout mockups from Claude"* are parsed into keywords that filter title, description, tags, and stored content text.

Both use a pluggable provider (`apps/web/lib/llm/`):

- **Local dev:** Ollama (`llama3.2`) at `localhost:11434`
- **Production:** Set `GROQ_API_KEY` + `LLM_PROVIDER=groq` on Vercel (Ollama cannot run in serverless)

If no LLM is available, publish and keyword search still work — metadata falls back to filename heuristics.

---

## Deployment

| Item | Detail |
|------|--------|
| **Host** | Vercel (free tier) |
| **URL** | [https://ezra-test-web.vercel.app](https://ezra-test-web.vercel.app) |
| **Root directory** | `apps/web` |
| **Build** | Monorepo install from repo root; Tailwind v4 native binaries installed for Linux in `vercel.json` |
| **Secrets** | Supabase URL/keys, `ARTIFACT_HUB_API_KEY`, `NEXT_PUBLIC_APP_URL` in Vercel dashboard |

Redeploy: `./scripts/deploy-vercel.sh` or `npx vercel deploy --prod` from `apps/web`.

---

## Walkthrough (written)

### 1. Browse the gallery

Open [https://ezra-test-web.vercel.app](https://ezra-test-web.vercel.app). You should see seeded artifacts (mockups, reports, HTML demos). Use the search bar: try *"pricing page"* or *"Claude"*.

### 2. Publish an artifact

1. Click **Publish**
2. Drop an HTML, PNG, or PDF file
3. Wait for suggested title/tags (works locally with Ollama; on Vercel without Groq, fill manually)
4. Submit — you're redirected to the artifact detail page with preview

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
| **Cursor** | Primary IDE agent — scaffolding, features, Supabase wiring, MCP server, Vercel deploy |
| **Ollama** | Local LLM for metadata + search during development |
| **Claude Desktop + MCP** | End-to-end conversational workflow testing |

---

## What I'd do with another week

1. **Groq (or similar) in production** — LLM metadata/search on the live URL without local Ollama
2. **pgvector embeddings** — True semantic search; schema already has an embedding column
3. **Feedback digest** — LLM summary across reviewers for artifact owners
4. **GitHub → Vercel CI** — Auto-deploy `main` on push
5. **Merge to `main`** — Single default branch for reviewers cloning the repo
6. **Light E2E tests** — Playwright for publish → share → feedback happy path

---

## Seeded demo data

```bash
npm run seed          # 5 simulated AI artifacts
npm run seed:feedback # threaded reviewer comments
```

Requires Supabase credentials in `apps/web/.env.local`.
