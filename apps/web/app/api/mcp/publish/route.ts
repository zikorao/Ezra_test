import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/api-key";
import { publishArtifact } from "@/lib/artifacts";
import { createShareLink } from "@/lib/share";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = requireApiKey(request);
  if (auth) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const createShare = formData.get("create_share") === "true";
    const expiry = String(formData.get("share_expiry") ?? "7d");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field." }, { status: 400 });
    }

    const result = await publishArtifact({
      file,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      tags: String(formData.get("tags") ?? ""),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const response: Record<string, unknown> = {
      artifact: result.artifact,
      url: `${base}/artifacts/${result.artifact.id}`,
      message: `Published "${result.artifact.title}" with tags: ${result.artifact.tags.join(", ") || "none"}`,
    };

    if (createShare) {
      const preset = ["1d", "7d", "30d", "never"].includes(expiry)
        ? (expiry as "1d" | "7d" | "30d" | "never")
        : "7d";
      const share = await createShareLink(result.artifact.id, preset);
      if (!("error" in share)) {
        response.share_url = share.url;
        response.share_expires_at = share.shareLink.expires_at;
      }
    }

    return NextResponse.json(response, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
