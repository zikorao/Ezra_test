import { NextResponse } from "next/server";
import { validateShareToken } from "@/lib/share";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const result = await validateShareToken(token);

    if (!result.ok) {
      const status = result.reason === "expired" ? 410 : 404;
      const message =
        result.reason === "expired"
          ? "This share link has expired."
          : "Share link not found.";
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      artifact: result.artifact,
      shareLink: result.shareLink,
      fileUrl: result.fileUrl,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to resolve share link";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
