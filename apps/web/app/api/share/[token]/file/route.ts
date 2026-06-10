import { NextResponse } from "next/server";
import { validateShareToken } from "@/lib/share";
import { getArtifactSignedUrl } from "@/lib/artifacts";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const result = await validateShareToken(token);

    if (!result.ok) {
      const status = result.reason === "expired" ? 410 : 404;
      return NextResponse.json(
        { error: result.reason === "expired" ? "Link expired" : "Not found" },
        { status },
      );
    }

    const signedUrl = await getArtifactSignedUrl(result.artifact.storage_path);
    if (!signedUrl) {
      return NextResponse.json({ error: "File unavailable" }, { status: 500 });
    }

    return NextResponse.redirect(signedUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to serve file";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
