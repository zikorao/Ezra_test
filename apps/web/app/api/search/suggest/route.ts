import { NextResponse } from "next/server";
import { applyTraceHeaders } from "@/lib/observability/correlation";
import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { suggestSearch } from "@/lib/search/suggest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const limit = await enforceRateLimit(
    RATE_LIMIT_POLICIES.searchSuggest,
    request.headers,
  );
  if (!limit.allowed) {
    return applyTraceHeaders(rateLimitResponse(limit));
  }

  try {
    const { suggestions, source } = await suggestSearch(q);
    return applyTraceHeaders(NextResponse.json({ suggestions, source }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Suggest failed";
    return applyTraceHeaders(
      NextResponse.json({ error: message }, { status: 500 }),
    );
  }
}
