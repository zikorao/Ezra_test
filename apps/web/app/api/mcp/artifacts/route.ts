import { NextResponse } from "next/server";
import { extractApiKey, requireApiKey } from "@/lib/auth/api-key";
import { listArtifacts } from "@/lib/artifacts";
import {
  checkRateLimit,
  hashIdentifier,
  RATE_LIMIT_POLICIES,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { searchArtifacts } from "@/lib/search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = requireApiKey(request);
  if (auth) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (q) {
      const key = extractApiKey(request) ?? "unknown";
      const limit = await checkRateLimit(
        RATE_LIMIT_POLICIES.mcpSearch,
        hashIdentifier(key),
      );
      if (!limit.allowed) return rateLimitResponse(limit);
    }

    const artifacts = q ? await searchArtifacts(q) : await listArtifacts();

    return NextResponse.json({
      artifacts: artifacts.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        tags: a.tags,
        mime_type: a.mime_type,
        created_at: a.created_at,
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/artifacts/${a.id}`,
      })),
      count: artifacts.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list artifacts";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
