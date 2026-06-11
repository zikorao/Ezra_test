# Artifact Hub — Documentation

| Doc | Description |
|-----|-------------|
| [rate-limiting.md](./rate-limiting.md) | Supabase quotas on search, suggest, digest, MCP search |
| [observability-dashboards.md](./observability-dashboards.md) | Phoenix + Vercel Analytics trace correlation |
| This file | Claude Desktop MCP setup |

---

## Claude Desktop MCP

Connect Claude Desktop to the hosted Artifact Hub API for conversational publish, search, and review.

### Setup

1. **Generate an API key** (if you don't have one):
   ```bash
   npm run api-key
   ```
   Add the output to `apps/web/.env.local` as `ARTIFACT_HUB_API_KEY` and to Vercel production env.

2. **Copy MCP config** into Claude Desktop settings (`claude_desktop_config.json`):

   Use `docs/claude-desktop-config.json` as a template. Update:
   - `args[0]` — absolute path to `packages/mcp-server/src/index.mjs` on your machine
   - `ARTIFACT_HUB_API_URL` — `https://ezra-test-web.vercel.app` (or your deployment)
   - `ARTIFACT_HUB_API_KEY` — your key

3. **Restart Claude Desktop.**

### Example prompts

```
Search Artifact Hub for checkout mockups from Claude
List recent artifacts in Artifact Hub
Publish /path/to/mockup.html titled "Pricing v2" with tags claude, pricing
Create a 7-day share link for artifact <id>
Add feedback on artifact <id>: the CTA contrast is too low on mobile
```

### Tools exposed

| Tool | Description |
|------|-------------|
| `publish_artifact` | Upload a file; optional share link |
| `search_artifacts` | Natural-language search (hybrid FTS + vector + LLM); rate-limited per API key |
| `list_artifacts` | Recent catalog entries |
| `get_artifact` | Detail, feedback threads, share links |
| `create_share_link` | Time-limited share URL |
| `add_feedback` | Post a review comment |

### Run MCP server manually

```bash
ARTIFACT_HUB_API_URL=https://ezra-test-web.vercel.app \
ARTIFACT_HUB_API_KEY=your-key \
npm run mcp
```

The server uses stdio transport — Claude Desktop launches it automatically when configured.
