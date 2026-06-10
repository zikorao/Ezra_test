import type { Artifact } from "@/lib/types";
import { mimeLabel } from "@/lib/constants";

type Props = {
  artifact: Artifact;
  fileUrl: string | null;
  fileHref?: string;
};

export function ArtifactPreview({ artifact, fileUrl, fileHref }: Props) {
  return (
    <>
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
            Preview unavailable.
          </div>
        )}
      </div>

      {fileHref && fileUrl && (
        <div className="mt-4">
          <a
            href={fileHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent hover:underline"
          >
            Open original file →
          </a>
        </div>
      )}
    </>
  );
}
