# OpenTelemetry dashboards — Phoenix + Vercel Analytics

Artifact Hub uses a **unified OpenTelemetry stack** so server traces appear in both **Vercel Observability** and **Phoenix Cloud**, while **Vercel Web Analytics** custom events share the same `trace_id` for correlation.

## Architecture

```
Browser (Vercel Analytics + Speed Insights)
    │  custom events: search.suggest, search.submit, feedback.digest
    │  property: trace_id ← from x-trace-id response header
    ▼
Next.js API routes (instrumentation.ts → @vercel/otel)
    ├─ spanProcessors: ["auto"]     → Vercel OTEL / trace drains
    └─ spanProcessors: [Phoenix]    → Phoenix Cloud (LLM + pipeline spans)
```

## Setup

### 1. Phoenix (already configured)

```bash
PHOENIX_API_KEY=phx_...
PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com
PHOENIX_PROJECT_NAME=artifact-hub
```

### 2. Vercel Web Analytics

1. Vercel project → **Analytics** → Enable Web Analytics
2. Redeploy after merging this change (`@vercel/analytics` + `@vercel/speed-insights` in `app/layout.tsx`)

### 3. Vercel OpenTelemetry (optional trace drains)

1. Vercel project → **Observability** → **OpenTelemetry**
2. Add a trace drain (Datadog, Honeycomb, Axiom, etc.) or use the Vercel dashboard
3. `@vercel/otel` is registered in `instrumentation.ts` with `spanProcessors: ["auto", …]`

## Correlating traces

| Signal | Where | Correlation key |
|--------|--------|-----------------|
| Phoenix traces | [app.phoenix.arize.com](https://app.phoenix.arize.com) | `trace_id` on span |
| Vercel function logs | Vercel → Logs | `trace_id`, `span_id`, `vercel.deployment_id` in JSON |
| Vercel OTEL traces | Vercel Observability / drain | W3C `traceparent` / `trace_id` |
| Web Analytics events | Vercel → Analytics → Events | Custom property `trace_id` |

### API response headers

Traced API routes return:

- `x-trace-id` — OpenTelemetry trace ID (hex)
- `x-span-id` — active span ID

Client code reads these and passes `trace_id` into Vercel Analytics `track()`.

### Custom analytics events

| Event | When | Properties |
|-------|------|------------|
| `search.suggest` | Autocomplete fetch | `query_len`, `suggestions`, `source`, `trace_id` |
| `search.submit` | Gallery search submit | `query_len`, `has_query` |
| `feedback.digest` | Digest generated | `ok`, `artifact_id`, `themes`, `trace_id` |

## Example workflow

1. User types in search → `GET /api/search/suggest` runs `search.suggest` chain in Phoenix
2. Response includes `x-trace-id: abc123…`
3. Browser fires `track("search.suggest", { trace_id: "abc123…", … })`
4. In Phoenix, filter spans where `trace_id = abc123…`
5. In Vercel Analytics, filter events where `trace_id = abc123…`
6. In Vercel Logs, search `trace_id":"abc123…"` for structured JSON pipeline logs

## Local development

- Analytics runs in **development mode** (events logged to browser console)
- Phoenix export works when `PHOENIX_API_KEY` is set in `apps/web/.env.local`
- Run `npm run test:observability` to verify Phoenix export

## Related docs

- [rate-limiting.md](./rate-limiting.md) — quotas on search, suggest, and digest (429 responses include the same trace headers when limited)
