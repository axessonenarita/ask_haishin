import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateSlug } from "@/lib/slug";
import type { StreamStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const SLUG_RETRY = 5;

const STATUSES: readonly StreamStatus[] = ["waiting", "live", "ended"];

function isStatus(v: unknown): v is StreamStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("streams")
    .select("*")
    .order("start_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ streams: data ?? [] });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const p = payload as Record<string, unknown>;
  const title = String(p.title ?? "").trim();
  const start_at = String(p.start_at ?? "").trim();
  const hls_url = String(p.hls_url ?? "").trim();
  const status = p.status;

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (!start_at || Number.isNaN(Date.parse(start_at))) {
    return NextResponse.json({ error: "invalid start_at" }, { status: 400 });
  }
  if (!isHttpUrl(hls_url)) {
    return NextResponse.json({ error: "invalid hls_url" }, { status: 400 });
  }
  if (!isStatus(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const supabase = getAdminClient();

  for (let i = 0; i < SLUG_RETRY; i++) {
    const slug = generateSlug();
    const { data, error } = await supabase
      .from("streams")
      .insert({ title, start_at, hls_url, status, slug })
      .select()
      .single();

    if (!error) {
      return NextResponse.json({ stream: data });
    }
    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "slug collision, retry" },
    { status: 500 },
  );
}
