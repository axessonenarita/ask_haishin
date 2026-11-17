"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { currentLine, lineStarts, parseLines } from "@/lib/norito/lines";
import { addCount, loadCounts, summarize, type Counts } from "@/lib/norito/local";
import type { Prayer } from "@/lib/norito/types";

const GOALS = [0, 10, 30, 108] as const;

type WakeLockSentinelLike = { release: () => Promise<void> };

export function ChantView({
  prayers,
  lockedCount,
  member,
}: {
  prayers: Prayer[];
  lockedCount: number;
  member: boolean;
}) {
  const [slug, setSlug] = useState<string | null>(prayers[0]?.slug ?? null);
  const prayer = prayers.find((p) => p.slug === slug) ?? prayers[0] ?? null;
  const lines = useMemo(() => parseLines(prayer?.body ?? ""), [prayer?.body]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState(true);
  const [slow, setSlow] = useState(false);
  const [goal, setGoal] = useState<number>(30);
  const [session, setSession] = useState(0); // 今回続けて唱えた回数
  const [counts, setCounts] = useState<Counts>({});
  const [done, setDone] = useState(false);
  const wakeRef = useRef<WakeLockSentinelLike | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  useEffect(() => setCounts(loadCounts()), []);
  useEffect(() => {
    if (!slug && prayers[0]) setSlug(prayers[0].slug);
  }, [prayers, slug]);

  const stats = useMemo(() => summarize(counts, prayer?.slug ?? null), [counts, prayer?.slug]);
  const starts = useMemo(() => lineStarts(lines, duration), [lines, duration]);
  const idx = playing || t > 0 ? currentLine(starts, t) : -1;

  // 今の行が見えるように
  useEffect(() => {
    if (idx < 0) return;
    lineRefs.current[idx]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [idx]);

  const holdWake = useCallback(async (on: boolean) => {
    try {
      if (on && !wakeRef.current && "wakeLock" in navigator) {
        wakeRef.current = await (navigator as Navigator & {
          wakeLock: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
        }).wakeLock.request("screen");
      } else if (!on && wakeRef.current) {
        await wakeRef.current.release();
        wakeRef.current = null;
      }
    } catch {
      wakeRef.current = null;
    }
  }, []);

  const bump = useCallback(
    (delta: number) => {
      if (!prayer) return;
      setCounts((c) => addCount(c, prayer.slug, delta));
      setSession((s) => {
        const next = Math.max(0, s + delta);
        if (delta > 0 && goal > 0 && next >= goal) setDone(true);
        return next;
      });
    },
    [prayer, goal],
  );

  // 祝詞を替えたら止めてやり直し
  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setPlaying(false);
    setT(0);
    setDuration(null);
    setSession(0);
    setDone(false);
    holdWake(false);
  }, [prayer?.slug, holdWake]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = slow ? 0.85 : 1;
  }, [slow]);

  useEffect(() => {
    if (!prayer || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: prayer.title,
        artist: "祝詞",
        artwork: [{ src: "/norito/icon-512.png", sizes: "512x512", type: "image/png" }],
      });
    } catch {
      /* noop */
    }
  }, [prayer]);

  const onEnded = () => {
    bump(1);
    const reached = goal > 0 && session + 1 >= goal;
    const a = audioRef.current;
    if (repeat && !reached && a) {
      a.currentTime = 0;
      a.play().catch(() => setPlaying(false));
    } else {
      setPlaying(false);
      setT(0);
      holdWake(false);
    }
  };

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      holdWake(false);
    } else {
      if (done) {
        setSession(0);
        setDone(false);
      }
      a.playbackRate = slow ? 0.85 : 1;
      try {
        await a.play();
        setPlaying(true);
        holdWake(true);
      } catch {
        setPlaying(false);
      }
    }
  };

  if (!prayer) {
    return (
      <div className="px-5 py-16 text-center text-sm leading-7 text-nr-muted">
        祝詞はまだ準備中です。もうしばらくお待ちください。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      {prayers.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {prayers.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => setSlug(p.slug)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${
                p.slug === prayer.slug ? "border-nr-gold bg-nr-goldSoft text-nr-gold" : "border-nr-line text-nr-muted"
              }`}
            >
              {p.title}
              {p.members_only && <span className="ml-1 text-[10px] opacity-80">会員</span>}
            </button>
          ))}
        </div>
      )}

      {/* 回数 */}
      <section className="grid grid-cols-3 gap-2 rounded-2xl border border-nr-line bg-nr-panel p-4 text-center">
        <div>
          <div className="text-[11px] tracking-widest text-nr-muted">今回</div>
          <div className="font-mincho text-4xl tabular-nums text-nr-gold">
            {session}
            {goal > 0 && <span className="text-base text-nr-muted"> / {goal}</span>}
          </div>
        </div>
        <div>
          <div className="text-[11px] tracking-widest text-nr-muted">今日</div>
          <div className="font-mincho text-2xl tabular-nums">{stats.today}</div>
        </div>
        <div>
          <div className="text-[11px] tracking-widest text-nr-muted">これまで</div>
          <div className="font-mincho text-2xl tabular-nums">{stats.total.toLocaleString()}</div>
        </div>
        <div className="col-span-3 text-xs text-nr-muted">
          {stats.streak > 1 ? `${stats.streak}日続けて唱えています・` : ""}今月 {stats.monthDays}日
        </div>
      </section>

      {done && (
        <div className="rounded-xl border border-nr-gold bg-nr-goldSoft px-4 py-3 text-center text-sm text-nr-gold">
          {goal}回、唱え終えました。
        </div>
      )}

      {/* 本文 */}
      <section className="rounded-2xl border border-nr-line bg-nr-panel px-5 py-5">
        <h2 className="mb-3 font-mincho text-lg text-nr-gold">{prayer.title}</h2>
        <div className="max-h-[46vh] overflow-y-auto pr-1">
          {lines.map((l, i) => (
            <p
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              className={`font-mincho text-[1.15rem] leading-[2.2] transition-colors ${
                idx < 0 ? "text-nr-text" : i === idx ? "text-nr-gold" : i < idx ? "text-nr-text/80" : "text-nr-muted/70"
              }`}
            >
              {l.text}
            </p>
          ))}
        </div>
        {prayer.note && <p className="mt-3 text-xs leading-6 text-nr-muted">{prayer.note}</p>}
      </section>

      {/* 操作 */}
      {prayer.audio_url ? (
        <section className="flex flex-col gap-3">
          <audio
            ref={audioRef}
            src={prayer.audio_url}
            preload="metadata"
            playsInline
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || null)}
            onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
            onEnded={onEnded}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />
          {duration ? (
            <div className="h-1 overflow-hidden rounded bg-nr-line">
              <div className="h-full bg-nr-gold" style={{ width: `${Math.min(100, (t / duration) * 100)}%` }} />
            </div>
          ) : null}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setSlow((v) => !v)}
              className={`rounded-full border px-4 py-2 text-sm ${slow ? "border-nr-gold text-nr-gold" : "border-nr-line text-nr-muted"}`}
            >
              ゆっくり
            </button>
            <button
              type="button"
              onClick={toggle}
              className="h-16 w-16 rounded-full bg-nr-gold text-lg font-bold text-nr-bg"
              aria-label={playing ? "一時停止" : "唱える"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              onClick={() => setRepeat((v) => !v)}
              className={`rounded-full border px-4 py-2 text-sm ${repeat ? "border-nr-gold text-nr-gold" : "border-nr-line text-nr-muted"}`}
            >
              くり返す
            </button>
          </div>
          <p className="text-center text-xs leading-6 text-nr-muted">
            音声がひと回りするごとに1回と数えます。声に出さずに唱えるときは下の「＋1」を押してください。
          </p>
        </section>
      ) : (
        <p className="text-center text-xs leading-6 text-nr-muted">唱え終えたら「＋1」を押してください。</p>
      )}

      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => bump(-1)} className="rounded-full border border-nr-line px-4 py-2 text-sm text-nr-muted">
          −1
        </button>
        <button type="button" onClick={() => bump(1)} className="rounded-full border border-nr-gold px-8 py-3 text-base font-bold text-nr-gold">
          ＋1
        </button>
        <label className="flex items-center gap-1 text-xs text-nr-muted">
          目標
          <select
            value={goal}
            onChange={(e) => {
              setGoal(Number(e.target.value));
              setDone(false);
            }}
            className="rounded-md border border-nr-line bg-nr-panel px-2 py-1 text-nr-text"
          >
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {g === 0 ? "なし" : `${g}回`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!member && lockedCount > 0 && (
        <p className="text-center text-xs leading-6 text-nr-muted">
          ほかに {lockedCount} 本の祝詞があります。サロンの会員の方は、サロンの中のお知らせにある会員用のURLから開くと唱えられます。
        </p>
      )}
      <p className="text-center text-[11px] text-nr-muted/80">回数はこの端末の中だけに残ります。</p>
    </div>
  );
}
