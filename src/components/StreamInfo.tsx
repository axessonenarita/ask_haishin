"use client";

import type { Stream, StreamStatus } from "@/lib/types";
import { effectiveStreamStatus } from "@/lib/streamStatus";
import { useServerTime } from "@/lib/useServerTime";

const STATUS_LABEL: Record<StreamStatus, string> = {
  waiting: "開始前",
  live: "配信中",
  ended: "終了",
};

const STATUS_BADGE: Record<StreamStatus, string> = {
  waiting: "bg-neutral-600 text-white",
  live: "bg-red-600 text-white",
  ended: "bg-neutral-800 text-neutral-300",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type Props = {
  stream: Stream;
  playbackEnded?: boolean;
};

export function StreamInfo({ stream, playbackEnded }: Props) {
  const now = useServerTime();
  const status = effectiveStreamStatus(stream, now, playbackEnded);
  const startMs = new Date(stream.start_at).getTime();

  return (
    <div className="bg-bg-panel px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
        {status === "live" && (
          <span className="text-xs text-neutral-300">
            配信開始から <span className="font-mono">{formatDuration(now - startMs)}</span>
          </span>
        )}
        {status === "waiting" && (
          <span className="text-xs text-neutral-300">
            開始まで <span className="font-mono">{formatDuration(startMs - now)}</span>
          </span>
        )}
      </div>

      <h1 className="mt-1.5 text-base font-bold leading-tight md:text-lg">
        {stream.title}
      </h1>

      <div className="mt-0.5 text-[11px] text-neutral-400">
        開始：{formatDateTime(stream.start_at)}
      </div>

      {stream.description && (
        <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-neutral-300">
          {stream.description}
        </div>
      )}
    </div>
  );
}
