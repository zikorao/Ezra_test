import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/api-key";
import { createShareLink, type ExpiryPreset } from "@/lib/share";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const VALID = new Set(["1d", "7d", "30d", "never"]);

export async function POST(request: Request, { params }: Params) {
  const auth = requireApiKey(request);
  if (auth) return auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const expiry = (body.expiry ?? "7d") as ExpiryPreset;

    if (!VALID.has(expiry)) {
      return NextResponse.json(
        { error: "Invalid expiry. Use 1d, 7d, 30d, or never." },
        { status: 400 },
      );
    }

    const result = await createShareLink(id, expiry);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(
      {
        share_url: result.url,
        expires_at: result.shareLink.expires_at,
        token: result.shareLink.token,
      },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create share link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
