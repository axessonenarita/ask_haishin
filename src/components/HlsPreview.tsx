"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
  className?: string;
  autoPlay?: boolean;
};

function looksLikeHlsUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return u.pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return false;
  }
}

export function HlsPreview({ url, className, autoPlay = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!looksLikeHlsUrl(url)) return;
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setLoading(true);

    let cancelled = false;
    let hlsInstance: { destroy: () => void } | null = null;

    const onLoaded = () => {
      if (cancelled) return;
      setLoading(false);
    };
    const onError = () => {
      if (cancelled) return;
      setLoading(false);
      setError("再生に失敗しました");
    };

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("error", onError);

    const canNative = video.canPlayType("application/vnd.apple.mpegurl");

    (async () => {
      if (canNative) {
        video.src = url;
        return;
      }
      try {
        const mod = await import("hls.js");
        if (cancelled) return;
        const Hls = mod.default;
        if (!Hls.isSupported()) {
          setLoading(false);
          setError("このブラウザは HLS 非対応です");
          return;
        }
        const hls = new Hls({ enableWorker: true });
        hlsInstance = hls;
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            setLoading(false);
            setError(`HLS エラー: ${data.details ?? data.type}`);
          }
        });
        hls.loadSource(url);
        hls.attachMedia(video);
      } catch (e) {
        if (cancelled) return;
        setLoading(false);
        setError(
          `hls.js の読み込みに失敗: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    })();

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
      if (hlsInstance) hlsInstance.destroy();
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        // ignore
      }
    };
  }, [url]);

  if (!looksLikeHlsUrl(url)) {
    return (
      <div
        className={`flex aspect-video w-full items-center justify-center rounded-md border border-bg-border bg-black text-xs text-neutral-500 ${className ?? ""}`}
      >
        .m3u8 の URL を入力してください
      </div>
    );
  }

  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-md border border-bg-border bg-black ${className ?? ""}`}
    >
      <video
        ref={videoRef}
        controls
        muted
        playsInline
        autoPlay={autoPlay}
        className="h-full w-full bg-black"
      />
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-neutral-300">
          読み込み中…
        </div>
      )}
      {error && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-red-900/70 px-2 py-1 text-[11px] text-red-100">
          {error}
        </div>
      )}
    </div>
  );
}
