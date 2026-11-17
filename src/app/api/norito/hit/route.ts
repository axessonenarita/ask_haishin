import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { keyMatches, loadSettings } from "@/lib/norito/settings";

export const dynamic = "force-dynamic";

const KINDS = new Set(["open", "standalone", "push_on", "install_guide"]);

export async function POST(req: Request) {
  let p: Record<string, unknown>;
  try {
    p = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const kind = String(p.kind ?? "");
  const device_id = String(p.device_id ?? "").slice(0, 64);
  if (!KINDS.has(kind) || !device_id) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { settings } = await loadSettings();
  const member = keyMatches(typeof p.k === "string" ? p.k : null, settings.member_key);
  const supabase = getAdminClient();
  // 同じ端末の同じ種類は1日1回だけ数える
  const since = new Date(Date.now() - 20 * 3600_000).toISOString();
  const { count } = await supabase
    .from("norito_hits")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("device_id", device_id)
    .gte("created_at", since);
  if (!count) {
    await supabase.from("norito_hits").insert({ kind, device_id, member, ref: typeof p.ref === "string" ? p.ref.slice(0, 64) : null });
  }
  return NextResponse.json({ ok: true });
}
