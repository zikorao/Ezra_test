import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/api-key";
import { getArtifact, getArtifactSignedUrl } from "@/lib/artifacts";
import { listFeedback } from "@/lib/feedback";
import { listShareLinks, isShareLinkActive } from "@/lib/share";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = requireApiKey(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const artifact = await getArtifact(id);

    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }

    const [fileUrl, feedback, shareLinks] = await Promise.all([
      getArtifactSignedUrl(artifact.storage_path),
      listFeedback(id),
      listShareLinks(id),
    ]);

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const activeShares = shareLinks.filter(isShareLinkActive);

    return NextResponse.json({
      artifact: {
        ...artifact,
        url: `${base}/artifacts/${id}`,
        preview_url: fileUrl,
      },
      feedback_count: feedback.length,
      recent_feedback: feedback.slice(-3).map((f) => ({
        author: f.author_name,
        body: f.body.slice(0, 200),
        created_at: f.created_at,
      })),
      active_share_links: activeShares.map((s) => ({
        url: `${base}/s/${s.token}`,
        expires_at: s.expires_at,
        access_count: s.access_count,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to get artifact";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
