import type { Stream, StreamStatus } from "./types";

export function effectiveStreamStatus(
  stream: Stream,
  nowMs: number,
  playbackEnded = false,
): StreamStatus {
  if (stream.status === "ended" || playbackEnded) return "ended";
  if (nowMs < new Date(stream.start_at).getTime()) return "waiting";
  return "live";
}
