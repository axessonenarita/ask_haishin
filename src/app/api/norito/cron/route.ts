import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { WEEKLY, WEEKLY_HOUR_JST, jstAt, jstDate, jstDow } from "@/lib/norito/schedule";
import { loadSettings, saveSetting } from "@/lib/norito/settings";
import { sendPush } from "@/lib/norito/push";

export const dynamic = "force-dynamic";

// 奏上会の始まる少し前に通知を送る。5分おきに呼ばれる想定（README 参照）。
// 開始の15分前〜開始5分後のあいだに呼ばれたら、まだ送っていない回だけ送る。
const BEFORE_MS = 15 * 60_000;
const AFTER_MS = 5 * 60_000;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.get("authorization") ?? "";
  const q = new URL(req.url).searchParams.get("secret") ?? "";
  return h === `Bearer ${secret}` || q === secret;
}

function hhmm(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }).format(d);
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = new Date();
  const supabase = getAdminClient();
  const { settings, raw } = await loadSettings();
  const results: unknown[] = [];

  // 特別な予定
  const { data: events } = await supabase
    .from("norito_events")
    .select("*")
    .eq("notify", true)
    .is("notified_at", null)
    .gte("start_at", new Date(now.getTime() - AFTER_MS).toISOString())
    .lte("start_at", new Date(now.getTime() + BEFORE_MS).toISOString());
  const eventDates = new Set<string>();
  for (const e of events ?? []) {
    const at = new Date(e.start_at);
    eventDates.add(jstDate(at));
    const where = e.place === "salon" ? "サロン" : e.place === "youtube" ? "YouTube" : "";
    const r = await sendPush(
      {
        title: e.title,
        body: `${hhmm(at)}から${where ? `（${where}）` : ""}`,
        url: e.place === "salon" ? "/norito#schedule" : e.url || "/norito#schedule",
        tag: `event-${e.id}`,
      },
      { membersOnly: e.place === "salon" && !settings.sunday_notify_all },
    );
    await supabase.from("norito_events").update({ notified_at: now.toISOString() }).eq("id", e.id);
    results.push({ event: e.id, ...r });
  }

  // 毎週の奏上会
  const today = jstDate(now);
  const at = jstAt(today, WEEKLY_HOUR_JST);
  const w = WEEKLY.find((x) => x.dow === jstDow(at));
  const diff = at.getTime() - now.getTime();
  const sentKey = `reminded:${today}`;
  // 同じ日に特別な予定が登録されていれば、毎週の通知は出さない（予定そのものの通知に任せる）
  const { count: sameDay } = await supabase
    .from("norito_events")
    .select("id", { count: "exact", head: true })
    .gte("start_at", jstAt(today, 0).toISOString())
    .lt("start_at", new Date(jstAt(today, 0).getTime() + 86_400_000).toISOString());
  if (
    w &&
    diff <= BEFORE_MS &&
    diff >= -AFTER_MS &&
    !raw[sentKey] &&
    !settings.skip_dates.includes(today) &&
    !eventDates.has(today) &&
    !sameDay
  ) {
    const isSalon = w.place === "salon";
    const r = await sendPush(
      {
        title: "まもなく祝詞奏上会です",
        body: isSalon ? "21:00から（サロン）" : "21:00から（YouTube）",
        url: isSalon ? "/norito#schedule" : settings.youtube_url || "/norito#schedule",
        tag: `weekly-${today}`,
      },
      { membersOnly: isSalon && !settings.sunday_notify_all },
    );
    await saveSetting(sentKey, now.toISOString());
    results.push({ weekly: today, ...r });
  }

  return NextResponse.json({ ok: true, now: now.toISOString(), results });
}

export const GET = run;
export const POST = run;
