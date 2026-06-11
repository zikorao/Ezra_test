import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtifactPreview } from "@/components/artifact-preview";
import { FeedbackDigestPanel } from "@/components/feedback-digest";
import { FeedbackPanel } from "@/components/feedback-panel";
import { SharePanel } from "@/components/share-panel";
import { getArtifact, getArtifactSignedUrl } from "@/lib/artifacts";
import { listFeedback } from "@/lib/feedback";
import { listShareLinks, isShareLinkActive } from "@/lib/share";

type Props = { params: Promise<{ id: string }> };

export default async function ArtifactPage({ params }: Props) {
  const { id } = await params;

  let artifact;
  let shareLinks: Awaited<ReturnType<typeof listShareLinks>> = [];
  let feedback: Awaited<ReturnType<typeof listFeedback>> = [];

  try {
    artifact = await getArtifact(id);
    if (artifact) {
      shareLinks = await listShareLinks(id);
      feedback = await listFeedback(id);
    }
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
  const activeLinks = shareLinks.filter(isShareLinkActive);

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
        <ArtifactPreview
          artifact={artifact}
          fileUrl={fileUrl}
          fileHref={`/api/artifacts/${artifact.id}/file`}
        />

        <SharePanel artifactId={artifact.id} initialLinks={activeLinks} />

        <FeedbackDigestPanel
          artifactId={artifact.id}
          commentCount={feedback.length}
        />

        <FeedbackPanel artifactId={artifact.id} initialFeedback={feedback} />

        <div className="mt-6">
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
