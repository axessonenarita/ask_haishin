"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChantView } from "./ChantView";
import { InstallGuide } from "./InstallGuide";
import { deviceId, isStandalone, setStoredMemberKey, storedMemberKey } from "@/lib/norito/local";
import { registerSW } from "@/lib/norito/push-client";
import type { Letter, NoritoContent, SalonPost, ScheduleItem, Video } from "@/lib/norito/types";

type Tab = "chant" | "schedule" | "letters" | "videos" | "salon" | "guide";
const TABS: { id: Exclude<Tab, "guide">; label: string }[] = [
  { id: "chant", label: "唱える" },
  { id: "schedule", label: "予定" },
  { id: "letters", label: "便り" },
  { id: "videos", label: "探す" },
  { id: "salon", label: "サロン" },
];
const ALL_TABS: Tab[] = ["chant", "schedule", "letters", "videos", "salon", "guide"];

const WD = ["日", "月", "火", "水", "木", "金", "土"];
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("month")}/${g("day")}（${g("weekday")}）${g("hour")}:${g("minute")}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+09:00` : iso);
  const j = new Date(d.getTime() + 9 * 3600_000);
  return `${j.getUTCFullYear()}/${j.getUTCMonth() + 1}/${j.getUTCDate()}（${WD[j.getUTCDay()]}）`;
}

function hit(kind: string, memberKey: string | null) {
  try {
    fetch("/api/norito/hit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, device_id: deviceId(), k: memberKey }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* noop */
  }
}

function salonHref(from: string, memberKey: string | null): string {
  const q = new URLSearchParams({ from });
  try {
    q.set("d", deviceId());
  } catch {
    /* noop */
  }
  if (memberKey) q.set("k", memberKey);
  return `/api/norito/go?${q.toString()}`;
}

export function NoritoApp({ memberKey: urlKey }: { memberKey: string | null }) {
  const [tab, setTab] = useState<Tab>("chant");
  const [key, setKey] = useState<string | null>(urlKey);
  const [content, setContent] = useState<NoritoContent | null>(null);
  const [error, setError] = useState(false);
  const [standalone, setStandalone] = useState(true);

  // 会員用URLから開いたら鍵を覚えておく。ふつうの /norito でも前に覚えた鍵を使う。
  useEffect(() => {
    if (urlKey) setStoredMemberKey(urlKey);
    else setKey(storedMemberKey());
  }, [urlKey]);

  const load = useCallback(async (k: string | null) => {
    try {
      const res = await fetch(`/api/norito/content${k ? `?k=${encodeURIComponent(k)}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as NoritoContent;
      if (k && !data.member && !urlKey) {
        setStoredMemberKey(null); // 古い鍵は捨てる
      }
      setContent(data);
      setError(false);
    } catch {
      setError(true);
    }
  }, [urlKey]);

  useEffect(() => {
    load(key);
  }, [key, load]);

  // 開いた数・ホーム画面から開いた数を数える（1日1回）
  useEffect(() => {
    const s = isStandalone();
    setStandalone(s);
    hit("open", key);
    if (s) hit("standalone", key);
    registerSW();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // #schedule などで直接開く。通知を押したときもここに来る。
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace("#", "") as Tab;
      if (ALL_TABS.includes(h)) setTab(h);
    };
    apply();
    window.addEventListener("hashchange", apply);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "navigate" && typeof e.data.url === "string") {
        const u = new URL(e.data.url);
        if (u.hash) window.location.hash = u.hash;
        load(key);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("hashchange", apply);
      navigator.serviceWorker?.removeEventListener("message", onMsg);
    };
  }, [key, load]);

  const go = (t: Tab) => {
    setTab(t);
    try {
      history.replaceState(null, "", `#${t}`);
    } catch {
      /* noop */
    }
    window.scrollTo({ top: 0 });
    if (t === "guide") hit("install_guide", key);
  };

  const member = content?.member ?? false;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col">
      <header
        className="sticky top-0 z-20 flex items-center justify-between border-b border-nr-line bg-nr-bg/95 px-4 pb-3 backdrop-blur"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <div className="flex items-center gap-2">
          <h1 className="font-mincho text-xl tracking-widest text-nr-gold">祝詞</h1>
          {member && <span className="rounded border border-nr-gold/60 px-1.5 py-0.5 text-[10px] text-nr-gold">会員</span>}
        </div>
        <button
          type="button"
          onClick={() => go("guide")}
          className={`rounded-full border px-3 py-1 text-xs ${tab === "guide" ? "border-nr-gold text-nr-gold" : "border-nr-line text-nr-muted"}`}
        >
          使い方・通知
        </button>
      </header>

      <main className="flex-1 px-4 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }}>
        {!standalone && tab === "chant" && (
          <button
            type="button"
            onClick={() => go("guide")}
            className="mb-4 w-full rounded-xl border border-nr-line bg-nr-raised px-4 py-3 text-left text-sm leading-6"
          >
            ホーム画面に置くとアプリのように使えて、奏上会の前に通知も届きます。
            <span className="ml-1 text-nr-gold underline">置き方を見る</span>
          </button>
        )}

        {error && !content && (
          <div className="py-16 text-center text-sm leading-7 text-nr-muted">
            読み込めませんでした。電波のよいところで開き直してください。
            <div className="mt-3">
              <button type="button" onClick={() => load(key)} className="rounded-full border border-nr-line px-4 py-1.5 text-xs">
                もう一度
              </button>
            </div>
          </div>
        )}
        {!content && !error && <div className="py-16 text-center text-sm text-nr-muted">読み込んでいます…</div>}

        {content && tab === "chant" && (
          <ChantView prayers={content.prayers} lockedCount={content.locked.prayers} member={member} />
        )}
        {content && tab === "schedule" && (
          <ScheduleView items={content.schedule} member={member} memberKey={key} onGuide={() => go("guide")} />
        )}
        {content && tab === "letters" && <LettersView letters={content.letters} />}
        {content && tab === "videos" && (
          <VideosView videos={content.videos} lockedCount={content.locked.videos} member={member} memberKey={key} />
        )}
        {content && tab === "salon" && <SalonView posts={content.posts} member={member} memberKey={key} />}
        {tab === "guide" && (
          <InstallGuide vapidKey={content?.vapidPublicKey ?? null} memberKey={key} />
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-nr-line bg-nr-bg/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              className={`py-3 text-[13px] ${tab === t.id ? "font-bold text-nr-gold" : "text-nr-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function placeLabel(p: ScheduleItem["place"]): string {
  return p === "youtube" ? "YouTube" : p === "salon" ? "サロン" : "";
}

function ScheduleView({
  items,
  member,
  memberKey,
  onGuide,
}: {
  items: ScheduleItem[];
  member: boolean;
  memberKey: string | null;
  onGuide: () => void;
}) {
  const now = Date.now();
  return (
    <div className="flex flex-col gap-4 pb-6">
      <p className="text-sm leading-7 text-nr-muted">
        毎週土曜と日曜の21:00から祝詞奏上会があります。土曜は YouTube、日曜はサロンです。
        <button type="button" onClick={onGuide} className="ml-1 text-nr-gold underline">
          通知をオンにする
        </button>
      </p>
      <ul className="flex flex-col divide-y divide-nr-line rounded-2xl border border-nr-line bg-nr-panel">
        {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-nr-muted">いまは予定がありません。</li>}
        {items.map((it) => {
          const start = Date.parse(it.start_at);
          const live = now >= start && now < start + 2 * 3600_000;
          const href = it.place === "salon" ? salonHref("schedule", memberKey) : it.url;
          return (
            <li key={it.key} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm tabular-nums text-nr-text">
                  {fmtWhen(it.start_at)}
                  {live && <span className="ml-2 rounded bg-nr-gold px-1.5 py-0.5 text-[10px] font-bold text-nr-bg">いま</span>}
                </div>
                <div className="truncate text-xs text-nr-muted">
                  {it.title}
                  {it.note ? `・${it.note}` : ""}
                </div>
                {it.place === "salon" && !member && <div className="text-[11px] text-nr-muted/80">サロンの会員向けです</div>}
              </div>
              {placeLabel(it.place) && (
                <span className="shrink-0 rounded bg-nr-goldSoft px-2 py-0.5 text-[11px] text-nr-gold">{placeLabel(it.place)}</span>
              )}
              {href && (
                <a href={href} target="_blank" rel="noopener" className="shrink-0 text-xs text-nr-gold underline">
                  開く
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LettersView({ letters }: { letters: Letter[] }) {
  const [open, setOpen] = useState<string | null>(letters[0]?.id ?? null);
  if (letters.length === 0) {
    return <div className="py-16 text-center text-sm leading-7 text-nr-muted">便りは週に一度届きます。最初の便りをお待ちください。</div>;
  }
  return (
    <div className="flex flex-col gap-3 pb-6">
      {letters.map((l) => (
        <article key={l.id} className="rounded-2xl border border-nr-line bg-nr-panel">
          <button type="button" onClick={() => setOpen(open === l.id ? null : l.id)} className="w-full px-4 py-3 text-left">
            <div className="text-[11px] text-nr-muted">{fmtDate(l.published_at)}</div>
            <div className="font-mincho text-base text-nr-text">{l.title}</div>
          </button>
          {open === l.id && (
            <div className="whitespace-pre-wrap border-t border-nr-line px-4 py-4 text-[15px] leading-8">{l.body}</div>
          )}
        </article>
      ))}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  soujoukai: "奏上会",
  reading: "リーディング",
  iyasaka: "弥栄の記",
  other: "そのほか",
};

function VideosView({
  videos,
  lockedCount,
  member,
  memberKey,
}: {
  videos: Video[];
  lockedCount: number;
  member: boolean;
  memberKey: string | null;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string>("");
  const [person, setPerson] = useState<string>("");

  const kinds = useMemo(() => Array.from(new Set(videos.map((v) => v.kind))), [videos]);
  const people = useMemo(() => Array.from(new Set(videos.flatMap((v) => v.people ?? []))), [videos]);

  const filtered = useMemo(() => {
    const words = q.trim().split(/\s+/).filter(Boolean);
    return videos.filter((v) => {
      if (kind && v.kind !== kind) return false;
      if (person && !(v.people ?? []).includes(person)) return false;
      if (words.length) {
        const hay = `${v.chapter} ${v.title} ${v.summary ?? ""} ${(v.people ?? []).join(" ")}`;
        return words.every((w) => hay.includes(w));
      }
      return true;
    });
  }, [videos, q, kind, person]);

  // 弥栄の記の章ごとにまとめる（章のない動画は最後）
  const groups = useMemo(() => {
    const map = new Map<string, Video[]>();
    for (const v of filtered) {
      const k = v.chapter || "";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(v);
    }
    const named = Array.from(map.entries()).filter(([k]) => k);
    const rest = map.get("");
    return rest ? [...named, ["", rest] as [string, Video[]]] : named;
  }, [filtered]);

  if (videos.length === 0) {
    return <div className="py-16 text-center text-sm leading-7 text-nr-muted">動画の目録は準備中です。</div>;
  }

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-xs ${active ? "border-nr-gold bg-nr-goldSoft text-nr-gold" : "border-nr-line text-nr-muted"}`;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <input
        id="norito-video-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ことばで探す（例：シンガポール、響）"
        className="w-full rounded-xl border border-nr-line bg-nr-panel px-4 py-2.5 text-sm text-nr-text placeholder:text-nr-muted/70"
      />
      {kinds.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          <button type="button" className={chip(!kind)} onClick={() => setKind("")}>
            すべて
          </button>
          {kinds.map((k) => (
            <button key={k} type="button" className={chip(kind === k)} onClick={() => setKind(kind === k ? "" : k)}>
              {KIND_LABEL[k] ?? k}
            </button>
          ))}
        </div>
      )}
      {people.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {people.map((p) => (
            <button key={p} type="button" className={chip(person === p)} onClick={() => setPerson(person === p ? "" : p)}>
              {p}
            </button>
          ))}
        </div>
      )}

      {groups.map(([chapter, list]) => (
        <section key={chapter || "_"} className="flex flex-col gap-2">
          <h2 className="font-mincho text-base text-nr-gold">{chapter || "そのほかの動画"}</h2>
          {list.map((v) => (
            <article key={v.id} className="rounded-xl border border-nr-line bg-nr-panel px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-nr-muted">
                {v.aired_on && <span>{fmtDate(v.aired_on)}</span>}
                <span>{KIND_LABEL[v.kind] ?? v.kind}</span>
                {v.members_only && <span className="text-nr-gold">会員</span>}
              </div>
              <div className="mt-0.5 text-[15px] leading-7">{v.title}</div>
              {v.summary && <p className="mt-1 text-xs leading-6 text-nr-muted">{v.summary}</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {v.youtube_url && (
                  <a href={v.youtube_url} target="_blank" rel="noopener" className="text-nr-gold underline">
                    YouTube で見る
                  </a>
                )}
                {v.salon_url && (
                  <a
                    href={member ? v.salon_url : salonHref("video", memberKey)}
                    target="_blank"
                    rel="noopener"
                    className="text-nr-gold underline"
                  >
                    サロンで見る
                  </a>
                )}
              </div>
            </article>
          ))}
        </section>
      ))}
      {filtered.length === 0 && <p className="py-6 text-center text-sm text-nr-muted">見つかりませんでした。</p>}

      {!member && lockedCount > 0 && (
        <p className="text-center text-xs leading-6 text-nr-muted">
          サロンの回など、ほかに {lockedCount} 本あります。会員の方は、サロンの中のお知らせにある会員用のURLから開くとすべて出ます。
        </p>
      )}
    </div>
  );
}

function SalonView({ posts, member, memberKey }: { posts: SalonPost[]; member: boolean; memberKey: string | null }) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <section className="flex flex-col gap-1">
        <h2 className="font-mincho text-base text-nr-gold">サロンの新しい投稿</h2>
        <p className="text-xs leading-6 text-nr-muted">題名だけ載せています。続きはサロンで読めます。</p>
      </section>
      <ul className="flex flex-col divide-y divide-nr-line rounded-2xl border border-nr-line bg-nr-panel">
        {posts.length === 0 && <li className="px-4 py-6 text-center text-sm text-nr-muted">準備中です。</li>}
        {posts.map((p) => (
          <li key={p.id}>
            <a
              href={member && p.url ? p.url : salonHref("post", memberKey)}
              target="_blank"
              rel="noopener"
              className="block px-4 py-3"
            >
              <div className="text-[11px] text-nr-muted">
                {p.author ? `${p.author}・` : ""}
                {fmtDate(p.posted_at)}
              </div>
              <div className="text-[15px] leading-7">{p.title}</div>
            </a>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3 rounded-2xl border border-nr-line bg-nr-raised px-4 py-4">
        {member ? (
          <p className="text-sm leading-7">サロンを開いて、続きを読めます。</p>
        ) : (
          <p className="text-sm leading-7">
            DMM オンラインサロンです。毎日の投稿、リーディングの完全版、日曜の奏上会はサロンで見られます。
          </p>
        )}
        <a
          href={salonHref("salon_tab", memberKey)}
          target="_blank"
          rel="noopener"
          className="self-start rounded-full bg-nr-gold px-6 py-2.5 text-sm font-bold text-nr-bg"
        >
          サロンを開く
        </a>
        {!member && (
          <p className="text-[11px] leading-5 text-nr-muted">
            すでに会員の方は、サロンの中のお知らせにある会員用のURLから開くと、すべての祝詞と動画が出ます。
          </p>
        )}
      </section>
    </div>
  );
}
