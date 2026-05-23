"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Stream } from "@/lib/types";
import { getServerNow, useServerTime } from "@/lib/useServerTime";

const INTERVAL_VIDEO_URL =
  "https://vz-99df5632-92b.b-cdn.net/5d8cd7a4-9970-4c3e-bb01-f8392231de31/playlist.m3u8";
const PRE_ROLL_LEAD_MS = 30 * 60 * 1000;
const RESYNC_INTERVAL_MS = 15000;
const RESYNC_THRESHOLD_S = 5;
const CONTROLS_HIDE_DELAY_MS = 2500;

type Phase = "none" | "farWaiting" | "preRoll" | "live" | "postRoll" | "ended";

type Props = {
  stream: Stream | null;
  playbackEnded?: boolean;
  onPlaybackEnded?: () => void;
};

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

export function VideoPlayer({ stream, playbackEnded, onPlaybackEnded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = useServerTime();
  const [joined, setJoined] = useState(false);
  const [mainEnded, setMainEnded] = useState(false);
  const [postRollEnded, setPostRollEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    setMainEnded(false);
    setPostRollEnded(false);
    setError(null);
  }, [stream?.id]);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(
      () => setControlsVisible(false),
      CONTROLS_HIDE_DELAY_MS,
    );
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    showControls();
  }, [showControls]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = videoRef.current;
      if (!v) return;
      const value = Number(e.target.value);
      v.volume = value;
      v.muted = value === 0;
      setVolume(value);
      setMuted(value === 0);
      showControls();
    },
    [showControls],
  );

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v);
  }, []);

  const phase: Phase = useMemo(() => {
    if (!stream) return "none";
    if (stream.status === "ended" || playbackEnded || postRollEnded)
      return "ended";
    if (mainEnded) return "postRoll";
    const startMs = new Date(stream.start_at).getTime();
    if (now >= startMs) return "live";
    if (now >= startMs - PRE_ROLL_LEAD_MS) return "preRoll";
    return "farWaiting";
  }, [stream, now, mainEnded, postRollEnded, playbackEnded]);

  useEffect(() => {
    if (phase === "ended" && !playbackEnded) {
      onPlaybackEnded?.();
    }
  }, [phase, playbackEnded, onPlaybackEnded]);

  useEffect(() => {
    if (!joined) return;
    if (phase !== "live" && phase !== "preRoll" && phase !== "postRoll") return;
    const video = videoRef.current;
    if (!video) return;
    if (!stream) return;

    let cancelled = false;
    let hlsInstance: { destroy: () => void } | null = null;
    let driftTimer: ReturnType<typeof setInterval> | null = null;

    const startAtMs = new Date(stream.start_at).getTime();
    let src: string;
    let useLoop = false;
    let syncMode: "none" | "live" | "loop" = "none";
    let syncAnchorMs = 0;

    if (phase === "live") {
      src = stream.hls_url;
      syncMode = "live";
      syncAnchorMs = startAtMs;
    } else if (phase === "preRoll") {
      src = INTERVAL_VIDEO_URL;
      useLoop = true;
      syncMode = "loop";
      syncAnchorMs = startAtMs - PRE_ROLL_LEAD_MS;
    } else {
      src = INTERVAL_VIDEO_URL;
    }

    video.loop = useLoop;

    const computeTarget = (): number | null => {
      const elapsed = (getServerNow() - syncAnchorMs) / 1000;
      if (elapsed < 0) return null;
      if (syncMode === "loop") {
        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) return null;
        return elapsed % duration;
      }
      return elapsed;
    };

    const handleEnded = () => {
      if (phase === "live") {
        setMainEnded(true);
      } else if (phase === "postRoll") {
        setPostRollEnded(true);
      }
    };
    video.addEventListener("ended", handleEnded);

    const handleSeeked = () => {
      if (syncMode === "none") return;
      const target = computeTarget();
      if (target === null) return;
      let diff = target - video.currentTime;
      if (syncMode === "loop") {
        const duration = video.duration;
        if (Math.abs(diff) > duration / 2) {
          diff = diff > 0 ? diff - duration : diff + duration;
        }
      }
      if (Math.abs(diff) > RESYNC_THRESHOLD_S) {
        video.currentTime = Math.max(0, target);
      }
    };
    video.addEventListener("seeked", handleSeeked);

    const startPlayback = async () => {
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

      if (syncMode !== "none") {
        const seekToTarget = () => {
          const target = computeTarget();
          if (target !== null && Number.isFinite(target)) {
            video.currentTime = target;
          }
        };
        video.addEventListener("loadedmetadata", seekToTarget, { once: true });
      }

      try {
        await video.play();
      } catch {
        setError("再生を開始できませんでした");
      }

      if (syncMode !== "none") {
        driftTimer = setInterval(() => {
          if (!video.duration || video.paused) return;
          const target = computeTarget();
          if (target === null) return;
          let diff = target - video.currentTime;
          if (syncMode === "loop") {
            const duration = video.duration;
            if (Math.abs(diff) > duration / 2) {
              diff = diff > 0 ? diff - duration : diff + duration;
            }
          }
          if (Math.abs(diff) > RESYNC_THRESHOLD_S) {
            video.currentTime = Math.max(0, target);
          }
        }, RESYNC_INTERVAL_MS);
      }
    };

    void startPlayback();

    return () => {
      cancelled = true;
      if (driftTimer) clearInterval(driftTimer);
      if (hlsInstance) hlsInstance.destroy();
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("seeked", handleSeeked);
      video.loop = false;
      video.removeAttribute("src");
      video.load();
    };
  }, [joined, phase, stream]);

  if (phase === "none") {
    return (
      <Overlay>
        <div className="text-sm text-neutral-300">
          配信は予定されていません
        </div>
      </Overlay>
    );
  }

  if (phase === "farWaiting" && stream) {
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

  if (phase === "ended" && stream) {
    return (
      <Overlay>
        <div className="text-xs text-neutral-400">{stream.title}</div>
        <div className="mt-2 text-lg font-bold">配信は終了しました</div>
      </Overlay>
    );
  }

  return (
    <div
      className={`w-full bg-black ${
        isFullscreen
          ? "fixed inset-0 z-50 h-[100dvh]"
          : "relative aspect-video"
      }`}
      onMouseMove={showControls}
      onMouseLeave={() => setControlsVisible(false)}
      onTouchStart={showControls}
    >
      <video
        ref={videoRef}
        playsInline
        controls={false}
        disablePictureInPicture
        controlsList="nodownload noremoteplayback nofullscreen"
        className="absolute inset-0 h-full w-full"
        onClick={showControls}
      />

      {phase === "preRoll" && stream && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded bg-black/70 px-2 py-1 text-right text-white">
          <div className="text-[10px] text-neutral-300">開始まで</div>
          <div className="font-mono text-sm font-bold">
            {formatCountdown(new Date(stream.start_at).getTime() - now)}
          </div>
        </div>
      )}

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

      {joined && (
        <div
          className={`absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pt-6 pb-3 text-white transition-opacity duration-200 ${
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={toggleMute}
            className="rounded p-1 hover:bg-white/10"
            aria-label={muted ? "ミュート解除" : "ミュート"}
          >
            {muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-24 accent-white"
            aria-label="音量"
          />
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded p-1 hover:bg-white/10"
            aria-label={isFullscreen ? "フルスクリーン解除" : "フルスクリーン"}
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
          </button>
        </div>
      )}

      {error && (
        <div className="absolute bottom-14 left-2 right-2 rounded bg-red-950/80 px-2 py-1 text-xs text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}

function VolumeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.17v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  );
}

function EnterFullscreenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
    </svg>
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
