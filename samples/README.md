# Sample artifacts

Curated AI-style deliverables for demos, seeding, and feedback templates.

| File | Source tool | Type |
|------|-------------|------|
| `claude-*.html` | Claude | UX mockups, widgets, pricing |
| `gamma-*.html` | Gamma | Slide decks, agendas |
| `gpt-*.html` | GPT | Docs, runbooks, research |
| `midjourney-*.html` | Midjourney | Visual concepts (HTML stand-ins) |

## Add a sample

1. Drop an HTML file in `artifacts/`
2. Add an entry to `manifest.json` (title, description, tags)
3. Seed and index:

```bash
npm run seed:more
npm run index
```

## Seed feedback

The feedback seeder (`npm run seed:feedback`) picks topic-specific comment threads based on artifact title/tags — checkout flows get UX review threads, pitch decks get investor feedback, security runbooks get compliance notes, etc.

```bash
npm run seed:feedback                              # local API
API_URL=https://ezra-test-web.vercel.app npm run seed:feedback   # production

npm run seed:demo   # artifacts + feedback in one command
```

Re-runs skip artifacts that already have 3+ comments. Force re-seed: `FORCE=1 npm run seed:feedback`.
