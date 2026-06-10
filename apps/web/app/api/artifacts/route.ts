import { NextResponse } from "next/server";
import { listArtifacts, publishArtifact } from "@/lib/artifacts";

export const runtime = "nodejs";

export async function GET() {
  try {
    const artifacts = await listArtifacts();
    return NextResponse.json({ artifacts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list artifacts";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

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

    return NextResponse.json({ artifact: result.artifact }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
