import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 管理画面から祝詞・便り・予定・動画・新着をまとめて出し入れする
const TABLES: Record<string, { name: string; order: string; asc: boolean; pk: string; fields: string[] }> = {
  prayers: {
    name: "norito_prayers", order: "sort", asc: true, pk: "id",
    fields: ["id", "slug", "title", "body", "audio_url", "note", "members_only", "sort", "published"],
  },
  letters: {
    name: "norito_letters", order: "published_at", asc: false, pk: "id",
    fields: ["id", "title", "body", "published_at"],
  },
  events: {
    name: "norito_events", order: "start_at", asc: false, pk: "id",
    fields: ["id", "title", "start_at", "place", "url", "note", "notify"],
  },
  videos: {
    name: "norito_videos", order: "aired_on", asc: false, pk: "id",
    fields: ["id", "chapter", "title", "aired_on", "kind", "people", "summary", "youtube_url", "salon_url", "members_only", "sort"],
  },
  salon_posts: {
    name: "norito_salon_posts", order: "posted_at", asc: false, pk: "id",
    fields: ["id", "title", "author", "posted_at", "url"],
  },
};

function pick(row: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (!(f in row)) continue;
    const v = row[f];
    if (f === "id" && (v === "" || v === null)) continue;
    out[f] = v === "" ? null : v;
  }
  return out;
}

export async function GET(_req: Request, { params }: { params: { table: string } }) {
  const t = TABLES[params.table];
  if (!t) return NextResponse.json({ error: "unknown table" }, { status: 404 });
  const { data, error } = await getAdminClient()
    .from(t.name)
    .select("*")
    .order(t.order, { ascending: t.asc, nullsFirst: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

// 1件でも配列でも受け取り、id があれば上書き、なければ追加
export async function POST(req: Request, { params }: { params: { table: string } }) {
  const t = TABLES[params.table];
  if (!t) return NextResponse.json({ error: "unknown table" }, { status: 404 });
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const list = (Array.isArray(payload) ? payload : [payload]) as Record<string, unknown>[];
  if (list.length === 0) return NextResponse.json({ rows: [] });
  if (list.length > 1000) return NextResponse.json({ error: "too many rows" }, { status: 400 });
  const rows = list.map((r) => pick(r ?? {}, t.fields));
  if (params.table === "prayers") {
    for (const r of rows) {
      if (!r.slug || !r.title) return NextResponse.json({ error: "slug と title は必須です" }, { status: 400 });
    }
  } else if (params.table === "salon_posts") {
    for (const r of rows) {
      if (!r.id || !r.title || !r.posted_at) return NextResponse.json({ error: "id・title・posted_at は必須です" }, { status: 400 });
    }
  } else {
    for (const r of rows) {
      if (!r.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    }
  }
  const supabase = getAdminClient();
  const conflict = params.table === "prayers" ? "slug" : t.pk;
  const withId = rows.filter((r) => r.id !== undefined || params.table === "prayers" || params.table === "salon_posts");
  const withoutId = rows.filter((r) => !withId.includes(r));
  const out: unknown[] = [];
  if (withId.length) {
    const { data, error } = await supabase.from(t.name).upsert(withId, { onConflict: conflict }).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    out.push(...(data ?? []));
  }
  if (withoutId.length) {
    const { data, error } = await supabase.from(t.name).insert(withoutId).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    out.push(...(data ?? []));
  }
  return NextResponse.json({ rows: out });
}

export async function DELETE(req: Request, { params }: { params: { table: string } }) {
  const t = TABLES[params.table];
  if (!t) return NextResponse.json({ error: "unknown table" }, { status: 404 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await getAdminClient().from(t.name).delete().eq(t.pk, id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
