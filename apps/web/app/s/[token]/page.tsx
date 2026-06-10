import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtifactPreview } from "@/components/artifact-preview";
import { FeedbackPanel } from "@/components/feedback-panel";
import { listFeedback } from "@/lib/feedback";
import { resolveShareToken, formatExpiry } from "@/lib/share";

type Props = { params: Promise<{ token: string }> };

export default async function SharedArtifactPage({ params }: Props) {
  const { token } = await params;

  let result;
  try {
    result = await resolveShareToken(token);
  } catch {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-sm text-muted">
        Unable to load shared artifact. Check Supabase configuration.
      </div>
    );
  }

  if (!result.ok) {
    if (result.reason === "expired") {
      return (
        <div className="flex min-h-full flex-col items-center justify-center px-6 py-20 text-center">
          <h1 className="text-xl font-semibold">Link expired</h1>
          <p className="mt-2 max-w-md text-sm text-muted">
            This share link is no longer valid. Ask the publisher for a new link.
          </p>
          <Link
            href="/"
            className="mt-6 text-sm font-medium text-accent hover:underline"
          >
            Browse Artifact Hub
          </Link>
        </div>
      );
    }
    notFound();
  }

  const { artifact, shareLink, fileUrl } = result;
  const feedback = await listFeedback(artifact.id);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
              AH
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Shared artifact
            </span>
          </div>
          <span className="text-xs text-muted">
            {formatExpiry(shareLink.expires_at)}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <ArtifactPreview
          artifact={artifact}
          fileUrl={fileUrl}
          fileHref={`/api/share/${token}/file`}
        />

        <FeedbackPanel
          artifactId={artifact.id}
          shareToken={token}
          initialFeedback={feedback}
        />
      </main>
    </div>
  );
}
