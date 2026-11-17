import { NextResponse } from "next/server";
import { loadContent } from "@/lib/norito/content";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const k = new URL(req.url).searchParams.get("k");
  try {
    const content = await loadContent(k);
    return NextResponse.json(content, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
