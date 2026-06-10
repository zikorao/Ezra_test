import { NextResponse } from "next/server";
import { addFeedback, listFeedback } from "@/lib/feedback";
import { validateShareToken } from "@/lib/share";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

async function resolveArtifactId(token: string) {
  const result = await validateShareToken(token);
  if (!result.ok) {
    const status = result.reason === "expired" ? 410 : 404;
    const message =
      result.reason === "expired"
        ? "This share link has expired."
        : "Share link not found.";
    return { error: message, status } as const;
  }
  return { artifactId: result.artifact.id } as const;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveArtifactId(token);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const feedback = await listFeedback(resolved.artifactId);
    return NextResponse.json({ feedback });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load feedback";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveArtifactId(token);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const body = await request.json();
    const result = await addFeedback({
      artifactId: resolved.artifactId,
      authorName: String(body.author_name ?? ""),
      body: String(body.body ?? ""),
      parentId: body.parent_id ?? null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ feedback: result.feedback }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add feedback";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
