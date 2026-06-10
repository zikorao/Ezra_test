import { NextResponse } from "next/server";
import {
  createShareLink,
  listShareLinks,
  type ExpiryPreset,
} from "@/lib/share";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const VALID_EXPIRY = new Set(["1d", "7d", "30d", "never"]);

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const links = await listShareLinks(id);
    return NextResponse.json({ links });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list share links";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const expiry = (body.expiry ?? "7d") as ExpiryPreset;

    if (!VALID_EXPIRY.has(expiry)) {
      return NextResponse.json(
        { error: "Invalid expiry. Use 1d, 7d, 30d, or never." },
        { status: 400 },
      );
    }

    const result = await createShareLink(id, expiry);
    if ("error" in result) {
      const status = result.error === "Artifact not found." ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(
      { shareLink: result.shareLink, url: result.url },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create share link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
