import { NextResponse } from "next/server";
import { extractContentText } from "@/lib/artifacts/text";
import { isAllowedMimeType } from "@/lib/constants";
import { suggestMetadata } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field." }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentText = await extractContentText(buffer, mimeType);

    const metadata = await suggestMetadata({
      filename: file.name,
      mimeType,
      contentText,
    });

    return NextResponse.json({
      metadata,
      aiGenerated: metadata.description.length > 0 || metadata.tags.length > 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Metadata suggestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
