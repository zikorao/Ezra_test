import Link from "next/link";

export default function PublishPage() {
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
            ← Back to gallery
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Publish artifact</h1>
        <p className="mt-2 text-sm text-muted">
          Upload HTML, images, or PDFs. Metadata and tags will be auto-generated
          in the next step.
        </p>

        <div className="mt-8 flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Upload coming in Step 2
          </p>
          <p className="mt-2 text-xs text-muted">
            Supabase Storage + publish API will be wired here.
          </p>
        </div>
      </main>
    </div>
  );
}
