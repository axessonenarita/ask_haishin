import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { keyMatches, loadSettings } from "@/lib/norito/settings";

export const dynamic = "force-dynamic";

type Sub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function POST(req: Request) {
  let p: Record<string, unknown>;
  try {
    p = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const sub = (p.subscription ?? {}) as Sub;
  if (!sub.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  }
  const { settings } = await loadSettings();
  const member = keyMatches(typeof p.k === "string" ? p.k : null, settings.member_key);
  const device_id = typeof p.device_id === "string" ? p.device_id.slice(0, 64) : null;
  const supabase = getAdminClient();
  const { error } = await supabase.from("norito_push_subs").upsert({
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    member,
    device_id,
    last_seen_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (device_id) {
    await supabase.from("norito_hits").insert({ kind: "push_on", device_id, member });
  }
  return NextResponse.json({ ok: true, member });
}

export async function DELETE(req: Request) {
  let p: Record<string, unknown>;
  try {
    p = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const endpoint = typeof p.endpoint === "string" ? p.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  const supabase = getAdminClient();
  await supabase.from("norito_push_subs").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
