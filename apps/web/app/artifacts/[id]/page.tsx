import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtifact, getArtifactSignedUrl } from "@/lib/artifacts";
import { mimeLabel } from "@/lib/constants";

type Props = { params: Promise<{ id: string }> };

export default async function ArtifactPage({ params }: Props) {
  const { id } = await params;

  let artifact;
  try {
    artifact = await getArtifact(id);
  } catch {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-sm text-muted">
        Supabase is not configured. Add credentials to{" "}
        <code className="text-foreground">.env.local</code> and run migrations.
      </div>
    );
  }

  if (!artifact) notFound();

  const fileUrl = await getArtifactSignedUrl(artifact.storage_path);

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

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-muted">
            {mimeLabel(artifact.mime_type)}
          </span>
          {artifact.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted"
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{artifact.title}</h1>
        {artifact.description && (
          <p className="mt-2 text-muted">{artifact.description}</p>
        )}

        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
          {fileUrl && artifact.mime_type.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={artifact.title}
              className="max-h-[70vh] w-full object-contain"
            />
          )}
          {fileUrl && artifact.mime_type === "text/html" && (
            <iframe
              src={fileUrl}
              title={artifact.title}
              className="h-[70vh] w-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
          {fileUrl && artifact.mime_type === "application/pdf" && (
            <iframe
              src={fileUrl}
              title={artifact.title}
              className="h-[70vh] w-full border-0"
            />
          )}
          {!fileUrl && (
            <div className="flex h-48 items-center justify-center text-sm text-muted">
              Preview unavailable — check storage configuration.
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {fileUrl && (
            <a
              href={`/api/artifacts/${artifact.id}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              Open file
            </a>
          )}
          <Link
            href="/publish"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Publish another
          </Link>
        </div>
      </main>
    </div>
  );
}
