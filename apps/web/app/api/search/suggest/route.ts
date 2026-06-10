import { NextResponse } from "next/server";
import { suggestSearch } from "@/lib/search/suggest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const { suggestions, source } = await suggestSearch(q);
    return NextResponse.json({ suggestions, source });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Suggest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
