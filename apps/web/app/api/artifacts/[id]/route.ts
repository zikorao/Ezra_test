import { NextResponse } from "next/server";
import { getArtifact } from "@/lib/artifacts";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const artifact = await getArtifact(id);

    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }

    return NextResponse.json({ artifact });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load artifact";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
