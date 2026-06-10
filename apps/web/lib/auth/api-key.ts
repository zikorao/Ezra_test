import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function extractApiKey(request: Request): string | null {
  const header = request.headers.get("x-api-key");
  if (header) return header.trim();

  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  return null;
}

export function verifyApiKey(request: Request): boolean {
  const expected = process.env.ARTIFACT_HUB_API_KEY;
  if (!expected?.trim()) return false;

  const provided = extractApiKey(request);
  if (!provided) return false;

  return safeEqual(provided, expected.trim());
}

export function requireApiKey(request: Request): NextResponse | null {
  if (!verifyApiKey(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide X-API-Key or Authorization: Bearer." },
      { status: 401 },
    );
  }
  return null;
}
