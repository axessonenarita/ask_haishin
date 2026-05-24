"use client";

import { useEffect, useRef } from "react";
import type { Stream } from "@/lib/types";

type Props = {
  stream: Stream;
  onTimeUpdate?: (currentTime: number) => void;
};

export function ReplayPlayer({ stream, onTimeUpdate }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let hlsInstance: { destroy: () => void } | null = null;

    const setup = async () => {
      const native = video.canPlayType("application/vnd.apple.mpegurl");
      if (native) {
        video.src = stream.hls_url;
      } else {
        try {
          const mod = await import("hls.js");
          if (cancelled) return;
          const Hls = mod.default;
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hls.loadSource(stream.hls_url);
            hls.attachMedia(video);
            hlsInstance = hls;
          }
        } catch {
          // ignore
        }
      }
    };

    void setup();

    const handleTimeUpdate = () => {
      onTimeUpdate?.(video.currentTime);
    };
    const handleSeeked = () => {
      onTimeUpdate?.(video.currentTime);
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("seeked", handleSeeked);

    return () => {
      cancelled = true;
      if (hlsInstance) hlsInstance.destroy();
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("seeked", handleSeeked);
      video.removeAttribute("src");
      video.load();
    };
  }, [stream.hls_url, onTimeUpdate]);

  return (
    <div className="relative aspect-video w-full bg-black">
      <video
        ref={videoRef}
        controls
        playsInline
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
