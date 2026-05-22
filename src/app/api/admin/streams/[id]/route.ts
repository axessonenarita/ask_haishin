import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { StreamStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!params.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const p = payload as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if (p.title !== undefined) {
    const t = String(p.title).trim();
    if (!t) {
      return NextResponse.json({ error: "title empty" }, { status: 400 });
    }
    update.title = t;
  }
  if (p.description !== undefined) {
    const d = typeof p.description === "string" ? p.description : "";
    update.description = d || null;
  }
  if (p.start_at !== undefined) {
    const s = String(p.start_at).trim();
    if (!s || Number.isNaN(Date.parse(s))) {
      return NextResponse.json({ error: "invalid start_at" }, { status: 400 });
    }
    update.start_at = s;
  }
  if (p.hls_url !== undefined) {
    const u = String(p.hls_url).trim();
    if (!isHttpUrl(u)) {
      return NextResponse.json({ error: "invalid hls_url" }, { status: 400 });
    }
    update.hls_url = u;
  }
  if (p.status !== undefined) {
    if (!isStatus(p.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update.status = p.status;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("streams")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ stream: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!params.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { error } = await supabase.from("streams").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
