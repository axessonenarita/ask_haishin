import { NextResponse } from "next/server";
import { loadSettings, newMemberKey, saveSetting } from "@/lib/norito/settings";

export const dynamic = "force-dynamic";

const EDITABLE = new Set(["salon_url", "youtube_url", "skip_dates", "sunday_notify_all"]);

export async function GET() {
  const { settings } = await loadSettings();
  return NextResponse.json({
    settings,
    vapidConfigured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    cronConfigured: Boolean(process.env.CRON_SECRET),
  });
}

export async function POST(req: Request) {
  let p: Record<string, unknown>;
  try {
    p = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (p.action === "new_member_key") {
    const key = newMemberKey();
    await saveSetting("member_key", key);
    return NextResponse.json({ member_key: key });
  }
  for (const [k, v] of Object.entries(p)) {
    if (!EDITABLE.has(k)) continue;
    await saveSetting(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v ?? ""));
  }
  const { settings } = await loadSettings();
  return NextResponse.json({ settings });
}
