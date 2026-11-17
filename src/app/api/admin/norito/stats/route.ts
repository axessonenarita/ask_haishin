import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 数：開いた端末、ホーム画面から開いた端末、通知オン、サロンへ押した数
export async function GET() {
  const supabase = getAdminClient();
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("norito_hits")
    .select("kind,device_id,member,created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { count: subs } = await supabase.from("norito_push_subs").select("endpoint", { count: "exact", head: true });
  const { count: memberSubs } = await supabase
    .from("norito_push_subs")
    .select("endpoint", { count: "exact", head: true })
    .eq("member", true);

  const week = Date.now() - 7 * 86_400_000;
  const kinds = ["open", "standalone", "push_on", "salon_click"];
  const summary: Record<string, { devices: number; devices7d: number; hits7d: number; members: number }> = {};
  for (const k of kinds) {
    const rows = (data ?? []).filter((r) => r.kind === k);
    const all = new Set(rows.map((r) => r.device_id));
    const recent = rows.filter((r) => Date.parse(r.created_at) >= week);
    summary[k] = {
      devices: all.size,
      devices7d: new Set(recent.map((r) => r.device_id)).size,
      hits7d: recent.length,
      members: new Set(rows.filter((r) => r.member).map((r) => r.device_id)).size,
    };
  }
  // 日ごと（JST）
  const daily: Record<string, Record<string, number>> = {};
  for (const r of data ?? []) {
    const d = new Date(Date.parse(r.created_at) + 9 * 3600_000).toISOString().slice(0, 10);
    daily[d] ??= {};
    daily[d][r.kind] = (daily[d][r.kind] ?? 0) + 1;
  }
  return NextResponse.json({ summary, subscriptions: subs ?? 0, memberSubscriptions: memberSubs ?? 0, daily });
}
