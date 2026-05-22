"use client";

import { useEffect, useRef, useState } from "react";
import type { Stream, StreamStatus } from "@/lib/types";

const RESYNC_INTERVAL_MS = 15000;
const RESYNC_THRESHOLD_S = 5;

type Props = { stream: Stream | null };

function elapsedSeconds(startAtIso: string, nowMs: number): number {
  return (nowMs - new Date(startAtIso).getTime()) / 1000;
}

function effectiveStatus(stream: Stream, nowMs: number): StreamStatus {
  if (stream.status === "ended") return "ended";
  if (nowMs < new Date(stream.start_at).getTime()) return "waiting";
  return "live";
}

function formatStartAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatCountdown(diffMs: number): string {
  const total = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}時間${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

export function VideoPlayer({ stream }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!stream || !joined) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let hlsInstance: { destroy: () => void } | null = null;
    let driftTimer: ReturnType<typeof setInterval> | null = null;

    const startPlayback = async () => {
      const src = stream.hls_url;
      const native = video.canPlayType("application/vnd.apple.mpegurl");
      if (native) {
        video.src = src;
      } else {
        try {
          const mod = await import("hls.js");
          if (cancelled) return;
          const Hls = mod.default;
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hls.loadSource(src);
            hls.attachMedia(video);
            hlsInstance = hls;
          } else {
            setError("このブラウザではHLSを再生できません");
            return;
          }
        } catch {
          setError("プレーヤーの読み込みに失敗しました");
          return;
        }
      }

      const seekToLive = () => {
        const target = Math.max(0, elapsedSeconds(stream.start_at, Date.now()));
        if (Number.isFinite(target)) {
          video.currentTime = target;
        }
      };

      video.addEventListener("loadedmetadata", seekToLive, { once: true });

      try {
        await video.play();
      } catch {
        setError("再生を開始できませんでした");
      }

      driftTimer = setInterval(() => {
        if (!video.duration || video.paused) return;
        const expected = elapsedSeconds(stream.start_at, Date.now());
        if (expected < 0) return;
        const diff = expected - video.currentTime;
        if (Math.abs(diff) > RESYNC_THRESHOLD_S) {
          video.currentTime = Math.max(0, expected);
        }
      }, RESYNC_INTERVAL_MS);
    };

    void startPlayback();

    return () => {
      cancelled = true;
      if (driftTimer) clearInterval(driftTimer);
      if (hlsInstance) hlsInstance.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [stream, joined]);

  if (!stream) {
    return (
      <Overlay>
        <div className="text-sm text-neutral-300">
          配信は予定されていません
        </div>
      </Overlay>
    );
  }

  const status = effectiveStatus(stream, now);

  if (status === "waiting") {
    const diff = new Date(stream.start_at).getTime() - now;
    return (
      <Overlay>
        <div className="text-xs text-neutral-400">{stream.title}</div>
        <div className="mt-2 text-lg font-bold">まもなく開始します</div>
        <div className="mt-1 text-sm text-neutral-300">
          開始時刻：{formatStartAt(stream.start_at)}
        </div>
        <div className="mt-3 text-sm text-neutral-400">
          開始まで {formatCountdown(diff)}
        </div>
      </Overlay>
    );
  }

  if (status === "ended") {
    return (
      <Overlay>
        <div className="text-xs text-neutral-400">{stream.title}</div>
        <div className="mt-2 text-lg font-bold">配信は終了しました</div>
      </Overlay>
    );
  }

  return (
    <div className="relative aspect-video w-full bg-black">
      <video
        ref={videoRef}
        playsInline
        controls={false}
        disablePictureInPicture
        controlsList="nodownload noremoteplayback nofullscreen"
        className="absolute inset-0 h-full w-full"
      />

      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-xs font-bold">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span>PREMIERE</span>
      </div>

      {!joined && (
        <button
          type="button"
          onClick={() => setJoined(true)}
          className="absolute inset-0 flex items-center justify-center bg-black/70 text-white"
        >
          <span className="rounded-md bg-blue-600 px-6 py-3 text-base font-bold hover:bg-blue-500">
            配信に参加
          </span>
        </button>
      )}

      {error && (
        <div className="absolute bottom-2 left-2 right-2 rounded bg-red-950/80 px-2 py-1 text-xs text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative aspect-video w-full bg-black">
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
