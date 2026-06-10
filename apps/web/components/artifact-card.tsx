import Link from "next/link";
import type { Artifact } from "@/lib/types";
import { mimeLabel } from "@/lib/constants";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <article className="group flex flex-col rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-muted">
          {mimeLabel(artifact.mime_type)}
        </span>
        <span className="text-xs text-muted">{formatDate(artifact.created_at)}</span>
      </div>
      <Link href={`/artifacts/${artifact.id}`} className="block">
        <h3 className="font-medium text-foreground group-hover:text-accent">
          {artifact.title}
        </h3>
        {artifact.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted">
            {artifact.description}
          </p>
        )}
      </Link>
      {artifact.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {artifact.tags.map((tag) => (
            <Link
              key={tag}
              href={`/?q=${encodeURIComponent(tag)}`}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
