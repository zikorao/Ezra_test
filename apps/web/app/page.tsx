import Link from "next/link";
import { Suspense } from "react";
import { ArtifactCard } from "@/components/artifact-card";
import { GallerySearch } from "@/components/gallery-search";
import { searchArtifacts } from "@/lib/search";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function Home({ searchParams }: Props) {
  const { q } = await searchParams;
  let artifacts: Awaited<ReturnType<typeof searchArtifacts>> = [];
  let loadError: string | null = null;

  try {
    artifacts = q?.trim() ? await searchArtifacts(q) : await searchArtifacts("");
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Could not connect to Supabase.";
  }

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
            <Link href="/about" className="hover:text-foreground">
              About
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
            catalog, share time-limited links, and collect structured feedback.
          </p>
        </section>

        {loadError && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Gallery unavailable: {loadError}. Copy{" "}
            <code className="font-mono text-xs">.env.example</code> to{" "}
            <code className="font-mono text-xs">apps/web/.env.local</code> and
            run Supabase migrations.
          </div>
        )}

        <Suspense fallback={<div className="mb-6 h-10 animate-pulse rounded-lg bg-stone-100" />}>
          <GallerySearch initialQuery={q ?? ""} />
        </Suspense>

        {q && artifacts.length > 0 && (
          <p className="mb-4 text-sm text-muted">
            {artifacts.length} result{artifacts.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
          </p>
        )}

        {artifacts.length > 0 ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artifacts.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} />
            ))}
          </section>
        ) : (
          !loadError && (
            <section className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-2xl">
                {q ? "🔍" : "📦"}
              </div>
              <h2 className="text-lg font-medium text-foreground">
                {q ? "No matching artifacts" : "No artifacts yet"}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted">
                {q
                  ? "Try different keywords or browse the full gallery."
                  : "Publish HTML, images, or PDFs — they appear here instantly."}
              </p>
              <Link
                href={q ? "/" : "/publish"}
                className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                {q ? "View all artifacts" : "Publish an artifact"}
              </Link>
            </section>
          )
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        Artifact Hub — Round 2 Challenge
      </footer>
    </div>
  );
}
