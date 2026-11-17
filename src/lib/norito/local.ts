"use client";

// 端末の中だけに残すもの（回数・端末ID・会員用の鍵）。読めないときは何もせず動く。

const COUNTS = "norito:counts:v1";
const DEVICE = "norito:device";
const MEMBER = "norito:member-key";

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 保存できない端末では、その場だけ数える */
  }
}

export function deviceId(): string {
  let id = read<string | null>(DEVICE, null);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    write(DEVICE, id);
  }
  return id;
}

export function storedMemberKey(): string | null {
  return read<string | null>(MEMBER, null);
}
export function setStoredMemberKey(k: string | null) {
  if (k) write(MEMBER, k);
  else {
    try {
      localStorage.removeItem(MEMBER);
    } catch {
      /* noop */
    }
  }
}

export type Counts = Record<string, Record<string, number>>; // 日付 → 祝詞slug → 回数

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function loadCounts(): Counts {
  return read<Counts>(COUNTS, {});
}

export function addCount(counts: Counts, slug: string, delta: number): Counts {
  const date = localDate();
  const day = { ...(counts[date] ?? {}) };
  day[slug] = Math.max(0, (day[slug] ?? 0) + delta);
  const next = { ...counts, [date]: day };
  write(COUNTS, next);
  return next;
}

export function summarize(counts: Counts, slug: string | null) {
  const today = localDate();
  const month = today.slice(0, 7);
  let total = 0;
  let todayN = 0;
  let todayAll = 0;
  const monthDays = new Set<string>();
  for (const [date, bySlug] of Object.entries(counts)) {
    for (const [s, n] of Object.entries(bySlug)) {
      if (n <= 0) continue;
      if (!slug || s === slug) total += n;
      if (date === today) {
        todayAll += n;
        if (!slug || s === slug) todayN += n;
      }
      if (date.startsWith(month)) monthDays.add(date);
    }
  }
  // 続けて唱えた日数（今日か昨日から遡る）
  let streak = 0;
  const d = new Date();
  if (!Object.values(counts[today] ?? {}).some((n) => n > 0)) d.setDate(d.getDate() - 1);
  for (;;) {
    const key = localDate(d);
    if (Object.values(counts[key] ?? {}).some((n) => n > 0)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return { total, today: todayN, todayAll, monthDays: monthDays.size, streak };
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type Platform = "ios-safari" | "ios-other" | "in-app" | "android" | "desktop";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/\bLine\/|Instagram|\bFB[AV]N?\/|Twitter|musical_ly|BytedanceWebview|Android.*;\s*wv\)/i.test(ua)) return "in-app";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  if (ios) {
    if (/CriOS|FxiOS|EdgiOS/i.test(ua)) return "ios-other";
    if (!/Safari\//i.test(ua)) return "in-app";
    return "ios-safari";
  }
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}
