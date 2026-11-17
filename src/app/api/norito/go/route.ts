import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { keyMatches, loadSettings } from "@/lib/norito/settings";

export const dynamic = "force-dynamic";

// アプリから DMM サロンへ。押された数を数えてから移る。
export async function GET(req: Request) {
  const u = new URL(req.url);
  const { settings } = await loadSettings();
  const device_id = (u.searchParams.get("d") ?? "").slice(0, 64) || "unknown";
  const from = (u.searchParams.get("from") ?? "").slice(0, 32) || null;
  const member = keyMatches(u.searchParams.get("k"), settings.member_key);
  try {
    await getAdminClient().from("norito_hits").insert({ kind: "salon_click", device_id, member, ref: from });
  } catch {
    // 数えられなくてもサロンへは送る
  }
  return NextResponse.redirect(settings.salon_url, 302);
}
