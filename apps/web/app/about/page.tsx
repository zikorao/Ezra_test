import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
              AH
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Artifact Hub
            </span>
          </Link>
          <Link href="/" className="text-sm font-medium text-muted hover:text-foreground">
            ← Gallery
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">About Artifact Hub</h1>
        <p className="mt-4 text-muted leading-relaxed">
          A platform for publishing, browsing, reviewing, and sharing AI-generated
          deliverables — HTML mockups, decks, PDFs, and images from tools like
          Claude, Gamma, GPT, and Midjourney.
        </p>

        <h2 className="mt-10 text-lg font-medium">Core loop</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Publish with metadata and auto-tagging</li>
          <li>Browse the gallery with hybrid search (FTS + vectors)</li>
          <li>Share time-limited links for reviewers</li>
          <li>Collect structured, threaded feedback</li>
          <li>Manage artifacts via MCP in Claude Desktop</li>
        </ol>

        <h2 className="mt-10 text-lg font-medium">Stack</h2>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          Next.js on Vercel · Supabase (Postgres + Storage + pgvector) · Groq /
          Ollama for metadata · MCP server for conversational workflows.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/publish"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Publish an artifact
          </Link>
          <a
            href="https://github.com/zikorao/Ezra_test"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-stone-50"
            target="_blank"
            rel="noopener noreferrer"
          >
            View source
          </a>
        </div>
      </main>
    </div>
  );
}
