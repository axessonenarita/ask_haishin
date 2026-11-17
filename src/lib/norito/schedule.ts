import type { NoritoEvent, NoritoEventPlace, ScheduleItem } from "./types";

// 毎週の奏上会：土曜は YouTube、日曜はサロン。どちらも 21:00（日本時間）。
export const WEEKLY = [
  { dow: 6, place: "youtube" as NoritoEventPlace, title: "祝詞奏上会（YouTube）" },
  { dow: 0, place: "salon" as NoritoEventPlace, title: "祝詞奏上会（サロン）" },
];
export const WEEKLY_HOUR_JST = 21;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 日本時間の日付文字列 YYYY-MM-DD */
export function jstDate(d: Date): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 日本時間の曜日（0=日） */
export function jstDow(d: Date): number {
  return new Date(d.getTime() + JST_OFFSET_MS).getUTCDay();
}

/** 日本時間 YYYY-MM-DD hh:00 を Date に */
export function jstAt(date: string, hour: number): Date {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+09:00`);
}

/**
 * これからの予定を並べる。毎週の奏上会を自動で足し、同じ日に特別な予定があれば自動の方は出さない。
 * skipDates は「この日は奏上会がない」日（YYYY-MM-DD）。
 */
export function buildSchedule(
  events: NoritoEvent[],
  opts: { now?: Date; days?: number; skipDates?: string[]; youtubeUrl?: string | null; salonUrl?: string | null } = {},
): ScheduleItem[] {
  const now = opts.now ?? new Date();
  const days = opts.days ?? 21;
  const skip = new Set(opts.skipDates ?? []);
  const from = now.getTime() - 2 * 60 * 60 * 1000; // 始まって2時間までは「今」として残す
  const until = now.getTime() + days * 24 * 60 * 60 * 1000;

  const items: ScheduleItem[] = [];
  const eventDates = new Set<string>();
  for (const e of events) {
    const t = Date.parse(e.start_at);
    if (Number.isNaN(t) || t < from || t > until) continue;
    eventDates.add(jstDate(new Date(t)));
    items.push({
      key: `e:${e.id}`,
      title: e.title,
      start_at: new Date(t).toISOString(),
      place: e.place,
      url: e.url,
      note: e.note,
      auto: false,
    });
  }

  for (let i = 0; i <= days; i++) {
    const date = jstDate(new Date(now.getTime() + i * 24 * 60 * 60 * 1000));
    const at = jstAt(date, WEEKLY_HOUR_JST);
    const w = WEEKLY.find((x) => x.dow === jstDow(at));
    if (!w) continue;
    if (skip.has(date) || eventDates.has(date)) continue;
    if (at.getTime() < from || at.getTime() > until) continue;
    items.push({
      key: `w:${date}`,
      title: w.title,
      start_at: at.toISOString(),
      place: w.place,
      url: w.place === "youtube" ? opts.youtubeUrl ?? null : opts.salonUrl ?? null,
      note: null,
      auto: true,
    });
  }

  items.sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  return items;
}
