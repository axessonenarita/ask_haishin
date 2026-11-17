import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/norito/push";

export const dynamic = "force-dynamic";

// 通知を送る。letter_id を渡すと、その便りの題名で送り、送った印を付ける。
export async function POST(req: Request) {
  let p: Record<string, unknown>;
  try {
    p = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const supabase = getAdminClient();
  let title = String(p.title ?? "").trim();
  let body = String(p.body ?? "").trim();
  let url = typeof p.url === "string" && p.url ? p.url : "/norito";
  const letterId = typeof p.letter_id === "string" ? p.letter_id : null;
  if (letterId) {
    const { data } = await supabase.from("norito_letters").select("id,title").eq("id", letterId).single();
    if (!data) return NextResponse.json({ error: "letter not found" }, { status: 404 });
    title = title || "今週の便りが届きました";
    body = body || data.title;
    url = "/norito#letters";
  }
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const r = await sendPush({ title, body, url, tag: letterId ? `letter-${letterId}` : undefined }, { membersOnly: p.members_only === true });
  if (!r.configured) return NextResponse.json({ error: "通知の鍵（VAPID）が設定されていません" }, { status: 500 });
  if (letterId) await supabase.from("norito_letters").update({ notified_at: new Date().toISOString() }).eq("id", letterId);
  return NextResponse.json(r);
}
