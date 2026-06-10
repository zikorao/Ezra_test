# AI Zero-Cost Architecture Stack

A local-first, $0 AI application stack based on the **2026 Edition** architecture diagram.

## Architecture Layers

1. **Frontend** — Next.js / Streamlit / Vercel (free tier)
2. **Agent Orchestrator** — LangGraph / crewAI
3. **RAG Pipeline** — Notion, Chroma, Qdrant (local)
4. **LLM Layer** — Ollama (Gemma, Llama 3.3, Mistral)
5. **Tool Use** — Model Context Protocol (MCP)
6. **Code Agent** — Aider / Claude Code CLI
7. **Data Layer** — SQLite, DuckDB, Supabase (free tier)
8. **Deployment** — Docker, Cloudflare Workers, Hugging Face
9. **Observability** — Phoenix (self-hosted)

## Reference

See `AI_Zero_cost_arc.gif` for the full architecture diagram.

## Status

🚧 Initial repository setup — implementation in progress.
