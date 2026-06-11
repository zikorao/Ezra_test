# Rate limiting — LLM endpoint protection

Artifact Hub uses **fixed-window rate limits** stored in Supabase so quotas are shared across all Vercel serverless instances. Limits apply before expensive Groq/Jina calls on search, suggest, and feedback digest paths.

## Setup

1. Apply migration 004:

```bash
npm run migrate:rate-limit
```

Or paste `supabase/migrations/004_rate_limit.sql` into the [Supabase SQL Editor](https://supabase.com/dashboard).

2. Redeploy the web app (limits are enforced in API routes and the gallery page).

No extra Vercel env vars are required unless you want to tune quotas (see below).

## Protected endpoints

| Endpoint | Bucket | Default limit |
|----------|--------|----------------|
| `GET /api/search/suggest` | IP | 60 / minute |
| Gallery search (`/?q=`) | IP | 20 / minute |
| `GET /api/artifacts/[id]/feedback/digest` | IP | 5 / 10 minutes |
| Same digest route | IP + artifact ID | 2 / 5 minutes per artifact |
| `GET /api/mcp/artifacts?q=` | API key (hashed) | 60 / minute |

Client IP is read from `x-forwarded-for` (first hop) or `x-real-ip` on Vercel.

## 429 response

```json
{
  "error": "Too many requests",
  "retry_after_seconds": 42
}
```

Headers: `Retry-After`, `X-RateLimit-Remaining`.

The gallery page shows an inline banner when search is rate-limited. Autocomplete silently stops suggesting; digest shows a retry countdown.

## Tuning (optional env vars)

Set in `apps/web/.env.local` or Vercel production:

| Variable | Default |
|----------|---------|
| `RATE_LIMIT_SEARCH_SUGGEST_PER_MIN` | 60 |
| `RATE_LIMIT_SEARCH_QUERY_PER_MIN` | 20 |
| `RATE_LIMIT_DIGEST_PER_10MIN` | 5 |
| `RATE_LIMIT_DIGEST_PER_ARTIFACT_5MIN` | 2 |
| `RATE_LIMIT_MCP_SEARCH_PER_MIN` | 60 |

## Implementation

- **Table:** `rate_limit_buckets` (`bucket_key`, `window_start`, `request_count`)
- **RPC:** `check_rate_limit(bucket_key, window_seconds, max_requests)` — atomic increment with `FOR UPDATE`
- **Module:** `apps/web/lib/rate-limit/index.ts`
- **Fail-open:** If the RPC is missing (migration not applied), requests are allowed and a warning is logged

## Related docs

- [observability-dashboards.md](./observability-dashboards.md) — trace correlation for search/digest events
- [README.md](./README.md) — MCP setup (search rate limits apply per API key)
