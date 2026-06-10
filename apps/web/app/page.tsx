import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
              AH
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Artifact Hub
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium text-muted">
            <Link href="/" className="text-foreground">
              Gallery
            </Link>
            <Link
              href="/publish"
              className="rounded-full bg-accent px-4 py-2 text-white transition-colors hover:bg-accent-hover"
            >
              Publish
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <section className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            AI-generated work, organized
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            Publish mockups, presentations, reports, and docs. Browse the
            catalog, share time-limited links, and collect structured feedback —
            no more expiring URLs lost in Slack threads.
          </p>
        </section>

        <section className="mb-6 flex items-center gap-3">
          <input
            type="search"
            placeholder="Search artifacts…"
            disabled
            className="h-10 flex-1 rounded-lg border border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted/60"
          />
          <div className="flex gap-2">
            {["All", "HTML", "Images", "PDFs"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-2xl">
            📦
          </div>
          <h2 className="text-lg font-medium text-foreground">
            No artifacts yet
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            The gallery will show published HTML, images, and PDFs with tags
            and metadata. Publish your first artifact to get started.
          </p>
          <Link
            href="/publish"
            className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Publish an artifact
          </Link>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        Artifact Hub — Round 2 Challenge
      </footer>
    </div>
  );
}
