import { NextResponse } from "next/server";
import { getArtifact, getArtifactSignedUrl } from "@/lib/artifacts";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Redirect to a short-lived signed URL for the artifact file. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const artifact = await getArtifact(id);

    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }

    const signedUrl = await getArtifactSignedUrl(artifact.storage_path);
    if (!signedUrl) {
      return NextResponse.json(
        { error: "Could not generate file URL." },
        { status: 500 },
      );
    }

    return NextResponse.redirect(signedUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to serve file";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
