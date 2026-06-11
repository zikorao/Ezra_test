import { NextResponse } from "next/server";
import { generateFeedbackDigest } from "@/lib/feedback/digest";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const result = await generateFeedbackDigest(id);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      digest: result.digest,
      commentCount: result.commentCount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Digest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
