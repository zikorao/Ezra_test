import { NextResponse } from "next/server";
import { applyTraceHeaders } from "@/lib/observability/correlation";
import { generateFeedbackDigest } from "@/lib/feedback/digest";
import { enforceDigestRateLimits, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const limit = await enforceDigestRateLimits(request.headers, id);
  if (!limit.allowed) {
    return applyTraceHeaders(rateLimitResponse(limit));
  }

  try {
    const result = await generateFeedbackDigest(id);
    if (!result.ok) {
      return applyTraceHeaders(
        NextResponse.json({ error: result.error }, { status: result.status }),
      );
    }

    return applyTraceHeaders(
      NextResponse.json({
        digest: result.digest,
        commentCount: result.commentCount,
      }),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Digest failed";
    return applyTraceHeaders(
      NextResponse.json({ error: message }, { status: 500 }),
    );
  }
}
