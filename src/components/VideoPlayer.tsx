"use client";

import * as Sentry from "@sentry/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import type { Stream } from "@/lib/types";
import { getServerNow, useServerTime } from "@/lib/useServerTime";

const INTERVAL_VIDEO_URL =
  "https://vz-99df5632-92b.b-cdn.net/5d8cd7a4-9970-4c3e-bb01-f8392231de31/playlist.m3u8";
const PRE_ROLL_LEAD_MS = 30 * 60 * 1000;
const INTERMISSION_LEAD_MS = 15 * 1000;
const RESYNC_INTERVAL_MS = 15000;
const RESYNC_THRESHOLD_S = 10;
const CATCH_UP_THRESHOLD_S = 3;
const MANIFEST_WAIT_MS = 5000;
const PLAY_RETRY_DELAY_MS = 400;
const STALL_CHECK_INTERVAL_MS = 2000;
const STALL_THRESHOLD_MS = 15000;
const RECOVERY_RESET_AFTER_MS = 30000;
const RECOVERY_COOLDOWN_MS = 1500;
const MAX_RECOVERY_ATTEMPTS = 3;

type Phase =
  | "none"
  | "farWaiting"
  | "preRoll"
  | "intermission"
  | "live"
  | "postRoll"
  | "ended";

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
  const now = useServerTime();
  const [joined, setJoined] = useState(false);
  const [mainEnded, setMainEnded] = useState(false);
  const [postRollEnded, setPostRollEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const [playbackKey, setPlaybackKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const recoveryAttemptsRef = useRef(0);
  const lastRecoveryAtRef = useRef(0);
  const exhaustedRef = useRef(false);
  // hls.js の autoLevelCapping を保持(-1 = 制限なし)。再生落ち時に
  // 段階的に下げ、再起動を跨いでも適用するため ref で持つ
  const autoLevelCapRef = useRef<number>(-1);

  useEffect(() => {
    setMainEnded(false);
    setPostRollEnded(false);
    setError(null);
    setLoading(false);
    setNeedsUnmute(false);
    recoveryAttemptsRef.current = 0;
    lastRecoveryAtRef.current = 0;
    exhaustedRef.current = false;
    autoLevelCapRef.current = -1;
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

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) setNeedsUnmute(false);
  }, []);

  const acceptUnmute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    setNeedsUnmute(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setNeedsUnmute(false);
    recoveryAttemptsRef.current = 0;
    lastRecoveryAtRef.current = 0;
    exhaustedRef.current = false;
    autoLevelCapRef.current = -1;
    setPlaybackKey((k) => k + 1);
  }, []);

  const phase: Phase = useMemo(() => {
    if (!stream) return "none";
    if (stream.status === "ended" || playbackEnded || postRollEnded)
      return "ended";
    if (mainEnded) return "postRoll";
    const startMs = new Date(stream.start_at).getTime();
    if (now >= startMs) return "live";
    if (now >= startMs - INTERMISSION_LEAD_MS) return "intermission";
    if (now >= startMs - PRE_ROLL_LEAD_MS) return "preRoll";
    return "farWaiting";
  }, [stream, now, mainEnded, postRollEnded, playbackEnded]);

  useEffect(() => {
    if (phase === "ended" && !playbackEnded) {
      onPlaybackEnded?.();
    }
  }, [phase, playbackEnded, onPlaybackEnded]);

  useEffect(() => {
    recoveryAttemptsRef.current = 0;
  }, [phase]);

  const computeSyncTargetSec = useCallback((): number | null => {
    const video = videoRef.current;
    if (!video || !stream) return null;
    const startAtMs = new Date(stream.start_at).getTime();
    let anchorMs: number;
    let isLoop = false;
    if (phase === "live") {
      anchorMs = startAtMs;
    } else if (phase === "preRoll") {
      anchorMs = startAtMs - PRE_ROLL_LEAD_MS;
      isLoop = true;
    } else {
      return null;
    }
    const elapsed = (getServerNow() - anchorMs) / 1000;
    if (elapsed < 0) return null;
    if (isLoop) {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return null;
      return elapsed % duration;
    }
    return elapsed;
  }, [phase, stream]);

  const catchUp = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const target = computeSyncTargetSec();
    if (target === null) return;
    video.currentTime = Math.max(0, target);
    trackEvent("catch_up_click", {
      stream_id: stream?.id,
      phase,
    });
  }, [computeSyncTargetSec, stream?.id, phase]);

  const behindSec = useMemo(() => {
    const video = videoRef.current;
    if (!video) return 0;
    if (phase !== "live" && phase !== "preRoll") return 0;
    const target = computeSyncTargetSec();
    if (target === null) return 0;
    let diff = target - video.currentTime;
    if (phase === "preRoll") {
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0) {
        if (Math.abs(diff) > duration / 2) {
          diff = diff > 0 ? diff - duration : diff + duration;
        }
      }
    }
    return diff;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, now, computeSyncTargetSec]);

  const showCatchUp = joined && !loading && behindSec > CATCH_UP_THRESHOLD_S;

  useEffect(() => {
    if (!joined) return;
    if (phase !== "live" && phase !== "preRoll" && phase !== "postRoll") return;
    const video = videoRef.current;
    if (!video) return;
    if (!stream) return;

    let cancelled = false;
    let cleanupInProgress = false;
    let hlsInstance: { destroy: () => void } | null = null;
    let driftTimer: ReturnType<typeof setInterval> | null = null;
    let stallTimer: ReturnType<typeof setInterval> | null = null;
    let resetCounterTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerFullRecovery = (
      reason: string,
      extra?: Record<string, unknown>,
    ) => {
      if (cancelled || cleanupInProgress) return;
      // exhausted を一度通過したら、もう一度再生されるまで完全に静かにする
      if (exhaustedRef.current) return;

      const sincePrev = Date.now() - lastRecoveryAtRef.current;
      if (sincePrev < RECOVERY_COOLDOWN_MS) return;
      lastRecoveryAtRef.current = Date.now();

      // 再生落ち発生時に画質を 1 段下げる(次回 hls 生成時から適用)
      const hls = hlsInstance as
        | (typeof hlsInstance & {
            currentLevel?: number;
            autoLevelCapping?: number;
            levels?: unknown[];
          })
        | null;
      if (hls && typeof hls.currentLevel === "number") {
        const currentMax =
          autoLevelCapRef.current >= 0
            ? autoLevelCapRef.current
            : hls.currentLevel;
        autoLevelCapRef.current = Math.max(0, currentMax - 1);
      } else if (autoLevelCapRef.current === -1) {
        // 万一情報が取れない場合は最低画質まで落とす
        autoLevelCapRef.current = 0;
      } else if (autoLevelCapRef.current > 0) {
        autoLevelCapRef.current -= 1;
      }

      const sentryContext = {
        level: "warning" as const,
        tags: {
          stream_id: stream.id,
          slug: stream.slug,
          phase,
          reason,
        },
        extra: {
          ...extra,
          attempt: recoveryAttemptsRef.current + 1,
          maxAttempts: MAX_RECOVERY_ATTEMPTS,
          autoLevelCapping: autoLevelCapRef.current,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
      };

      if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
        exhaustedRef.current = true;
        setError("再生が安定しません。「もう一度再生」をお試しください。");
        trackEvent("playback_recovery_exhausted", {
          reason,
          stream_id: stream.id,
          phase,
        });
        Sentry.captureException(
          new Error(`playback recovery exhausted: ${reason}`),
          sentryContext,
        );
        // これ以上検査しても無意味なので stall / drift タイマーを停止
        if (stallTimer) {
          clearInterval(stallTimer);
          stallTimer = null;
        }
        if (driftTimer) {
          clearInterval(driftTimer);
          driftTimer = null;
        }
        if (resetCounterTimer) {
          clearTimeout(resetCounterTimer);
          resetCounterTimer = null;
        }
        return;
      }
      recoveryAttemptsRef.current++;
      if (typeof console !== "undefined") {
        console.warn(
          `[VideoPlayer] recovery (${reason}) attempt ${recoveryAttemptsRef.current}/${MAX_RECOVERY_ATTEMPTS}`,
          extra,
        );
      }
      trackEvent("playback_recovery", {
        reason,
        attempt: recoveryAttemptsRef.current,
        stream_id: stream.id,
        phase,
      });
      if (recoveryAttemptsRef.current === 1) {
        Sentry.captureException(
          new Error(`playback recovery: ${reason}`),
          sentryContext,
        );
      }
      setPlaybackKey((k) => k + 1);
    };

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
    } else if (phase === "postRoll") {
      // postRoll は 1 回だけ再生して ended に遷移する(同期もループもしない)
      src = INTERVAL_VIDEO_URL;
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

    const handlePause = () => {
      if (video.ended) return;
      if (video.error) return;
      void video.play().catch(() => {});
    };
    video.addEventListener("pause", handlePause);

    const handleWaiting = () => setLoading(true);
    const handlePlaying = () => {
      setLoading(false);
      if (resetCounterTimer) clearTimeout(resetCounterTimer);
      resetCounterTimer = setTimeout(() => {
        if (cancelled) return;
        if (!video.paused && !video.error) {
          recoveryAttemptsRef.current = 0;
        }
      }, RECOVERY_RESET_AFTER_MS);
    };
    const handleCanPlay = () => setLoading(false);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("canplay", handleCanPlay);

    const handleVideoError = () => {
      const err = video.error;
      const code = err?.code ?? null;
      const codeName =
        code === 1
          ? "MEDIA_ERR_ABORTED"
          : code === 2
            ? "MEDIA_ERR_NETWORK"
            : code === 3
              ? "MEDIA_ERR_DECODE"
              : code === 4
                ? "MEDIA_ERR_SRC_NOT_SUPPORTED"
                : "UNKNOWN";
      triggerFullRecovery(`video.error ${codeName}`, {
        code,
        codeName,
        message: err?.message,
        networkState: video.networkState,
        readyState: video.readyState,
        currentSrc: video.currentSrc,
      });
    };
    video.addEventListener("error", handleVideoError);

    // stall検知: 再生中なのに currentTime が止まったままなら復旧
    let lastProgressTime = video.currentTime;
    let lastProgressAt = Date.now();
    const isHidden = (): boolean =>
      typeof document !== "undefined" && document.visibilityState === "hidden";
    const handleVisibilityChange = () => {
      // タブに戻ってきた直後は currentTime の進みが遅れるので
      // stall タイマーをリセットして誤検知を避ける
      lastProgressTime = video.currentTime;
      lastProgressAt = Date.now();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    // 連続して進行が確認できたチェック回数。一定回数を超えたら
    // recoveryAttemptsRef を 0 に戻す(別ハンドラの handlePlaying 経由
    // よりも確実)
    let consecutiveProgressChecks = 0;
    const PROGRESS_CHECKS_TO_RESET = Math.ceil(
      RECOVERY_RESET_AFTER_MS / STALL_CHECK_INTERVAL_MS,
    );
    stallTimer = setInterval(() => {
      if (cancelled) return;
      if (isHidden()) {
        lastProgressTime = video.currentTime;
        lastProgressAt = Date.now();
        return;
      }
      if (video.paused || video.ended || video.error) {
        lastProgressTime = video.currentTime;
        lastProgressAt = Date.now();
        consecutiveProgressChecks = 0;
        return;
      }
      if (video.currentTime > lastProgressTime + 0.1) {
        lastProgressTime = video.currentTime;
        lastProgressAt = Date.now();
        consecutiveProgressChecks++;
        if (
          consecutiveProgressChecks >= PROGRESS_CHECKS_TO_RESET &&
          recoveryAttemptsRef.current > 0
        ) {
          recoveryAttemptsRef.current = 0;
        }
        return;
      }
      // 進行していない
      consecutiveProgressChecks = 0;
      if (Date.now() - lastProgressAt > STALL_THRESHOLD_MS) {
        lastProgressAt = Date.now();
        triggerFullRecovery("stall", {
          currentTime: video.currentTime,
          paused: video.paused,
          ended: video.ended,
          readyState: video.readyState,
          networkState: video.networkState,
          buffered:
            video.buffered.length > 0
              ? video.buffered.end(video.buffered.length - 1)
              : null,
          duration: Number.isFinite(video.duration) ? video.duration : null,
          visibilityState:
            typeof document !== "undefined" ? document.visibilityState : "n/a",
        });
      }
    }, STALL_CHECK_INTERVAL_MS);

    setLoading(true);

    const attemptPlay = async (): Promise<void> => {
      // 1) 通常: 音声付きで2回試行
      for (let i = 0; i < 2; i++) {
        if (cancelled) return;
        try {
          await video.play();
          return;
        } catch {
          if (i === 0) {
            await new Promise((r) => setTimeout(r, PLAY_RETRY_DELAY_MS));
          }
        }
      }
      // 2) muted で再試行（多くのブラウザがmuted autoplayは許可）
      if (cancelled) return;
      try {
        video.muted = true;
        setMuted(true);
        setNeedsUnmute(true);
        await video.play();
        return;
      } catch {
        // 3) 最終的に失敗
        setError("再生を開始できませんでした");
      }
    };

    const startPlayback = async () => {
      const native = video.canPlayType("application/vnd.apple.mpegurl");
      if (native) {
        video.src = src;
      } else {
        try {
          const mod = await import("hls.js");
          if (cancelled) return;
          const Hls = mod.default;
          if (!Hls.isSupported()) {
            setError("このブラウザではHLSを再生できません");
            return;
          }
          const hls = new Hls({
            enableWorker: true,
            // ABR を安定寄りにチューニング
            abrEwmaDefaultEstimate: 500_000, // 初期帯域推定 500kbps(低めから入る)
            abrBandWidthFactor: 0.9, // 利用可能帯域の判定を保守的に
            abrBandWidthUpFactor: 0.7, // 上げる前にしっかり余裕がある時だけ
            // バッファ
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            backBufferLength: 30,
          });
          hlsInstance = hls;
          // 再生落ちで段階的に下げた autoLevelCap を新インスタンスにも反映
          if (autoLevelCapRef.current >= 0) {
            hls.autoLevelCapping = autoLevelCapRef.current;
          }

          // hls.js 自体の fatal error をリカバリ
          let hlsInPlaceRecoveryUsed = false;
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (!data || !data.fatal) return;
            if (cancelled) return;
            const networkDetails = (
              data as unknown as {
                networkDetails?: { status?: number; statusText?: string };
              }
            ).networkDetails;
            const extra = {
              hlsType: data.type,
              hlsDetails: data.details,
              hlsReason: data.reason,
              networkStatus: networkDetails?.status,
              networkStatusText: networkDetails?.statusText,
              src,
            };
            if (hlsInPlaceRecoveryUsed) {
              triggerFullRecovery(
                `hls fatal ${data.type} ${data.details}`,
                extra,
              );
              return;
            }
            hlsInPlaceRecoveryUsed = true;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              triggerFullRecovery(
                `hls fatal ${data.type} ${data.details}`,
                extra,
              );
            }
          });

          // マニフェストパース完了まで待ってから play する
          await new Promise<void>((resolve) => {
            let settled = false;
            const settle = () => {
              if (settled) return;
              settled = true;
              resolve();
            };
            hls.once(Hls.Events.MANIFEST_PARSED, settle);
            setTimeout(settle, MANIFEST_WAIT_MS);
            hls.attachMedia(video);
            hls.loadSource(src);
          });
          if (cancelled) return;
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
        if (video.readyState >= 1) {
          seekToTarget();
        } else {
          video.addEventListener("loadedmetadata", seekToTarget, {
            once: true,
          });
        }
      }

      await attemptPlay();

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
      cleanupInProgress = true;
      if (driftTimer) clearInterval(driftTimer);
      if (stallTimer) clearInterval(stallTimer);
      if (resetCounterTimer) clearTimeout(resetCounterTimer);
      if (hlsInstance) hlsInstance.destroy();
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleVideoError);
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
      setLoading(false);
      video.loop = false;
      video.removeAttribute("src");
      video.load();
    };
  }, [joined, phase, stream, playbackKey]);

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

  if (phase === "intermission" && stream) {
    const diff = new Date(stream.start_at).getTime() - now;
    return (
      <Overlay>
        <div className="text-xs text-neutral-400">{stream.title}</div>
        <div className="mt-3 animate-pulse text-xl font-bold">
          まもなく開始します
        </div>
        <div className="mt-3 font-mono text-sm text-neutral-300">
          {formatCountdown(diff)}
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
    >
      <video
        ref={videoRef}
        playsInline
        controls={false}
        disablePictureInPicture
        controlsList="nodownload noremoteplayback nofullscreen"
        className="absolute inset-0 h-full w-full"
      />

      {phase === "preRoll" && stream && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded bg-black/70 px-2 py-1 text-right text-white">
          <div className="text-[10px] text-neutral-300">開始まで</div>
          <div className="font-mono text-sm font-bold">
            {formatCountdown(new Date(stream.start_at).getTime() - now)}
          </div>
        </div>
      )}

      {!joined && stream?.status !== "ended" && phase !== "ended" && (
        <button
          type="button"
          onClick={() => {
            setJoined(true);
            trackEvent("stream_join", {
              stream_id: stream?.id,
              slug: stream?.slug,
              phase,
            });
          }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 text-white"
        >
          <span className="rounded-md bg-blue-600 px-6 py-3 text-base font-bold hover:bg-blue-500">
            配信に参加
          </span>
        </button>
      )}

      {joined && loading && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      {joined && needsUnmute && !error && (
        <button
          type="button"
          onClick={acceptUnmute}
          className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-xl hover:bg-blue-500"
        >
          <VolumeIcon />
          タップして音を出す
        </button>
      )}

      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 text-white">
          <div className="text-sm">{error}</div>
          <button
            type="button"
            onClick={retry}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500"
          >
            もう一度再生
          </button>
        </div>
      )}

      {showCatchUp && (
        <button
          type="button"
          onClick={catchUp}
          className="absolute bottom-14 right-3 z-10 flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-red-500"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-white" />
          ライブに追いつく ({Math.round(behindSec)}秒遅れ)
        </button>
      )}

      {joined && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pt-6 pb-3 text-white">
          <button
            type="button"
            onClick={toggleMute}
            className="rounded p-1 hover:bg-white/10"
            aria-label={muted ? "ミュート解除" : "ミュート"}
          >
            {muted ? <MuteIcon /> : <VolumeIcon />}
          </button>
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
      <div className="absolute inset-0 flex animate-fadeIn flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
