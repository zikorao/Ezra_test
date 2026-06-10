import { NextResponse } from "next/server";
import { getArtifact } from "@/lib/artifacts";
import { addFeedback, listFeedback } from "@/lib/feedback";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const artifact = await getArtifact(id);
    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }

    const feedback = await listFeedback(id);
    return NextResponse.json({ feedback });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load feedback";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const artifact = await getArtifact(id);
    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }

    const body = await request.json();
    const result = await addFeedback({
      artifactId: id,
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
