"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Message, Stream } from "@/lib/types";
import { MessageItem } from "./MessageItem";

type Props = {
  stream: Stream;
  messages: Message[];
  currentTime: number;
};

function formatVideoTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function ReplayChat({ stream, messages, currentTime }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const startMs = useMemo(
    () => new Date(stream.start_at).getTime(),
    [stream.start_at],
  );

  const visibleMessages = useMemo(() => {
    const visibleUntilMs = startMs + currentTime * 1000;
    return messages.filter(
      (m) => new Date(m.created_at).getTime() <= visibleUntilMs,
    );
  }, [messages, currentTime, startMs]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // 増加方向（再生で進む）の場合のみ下端へ追従
    if (visibleMessages.length > lastCountRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    lastCountRef.current = visibleMessages.length;
  }, [visibleMessages.length]);

  return (
    <div className="flex h-full flex-col bg-bg-panel">
      <div className="flex items-center justify-between border-b border-bg-border px-3 py-2">
        <div className="text-sm font-bold text-neutral-200">
          リプレイ チャット
        </div>
        <div className="font-mono text-[10px] text-neutral-400">
          {formatVideoTime(currentTime)} ・ {visibleMessages.length}/
          {messages.length}件
        </div>
      </div>

      <div
        ref={listRef}
        className="chat-scroll flex-1 overflow-y-auto pt-2 pb-4"
      >
        {visibleMessages.length === 0 ? (
          <div className="p-4 text-center text-sm text-neutral-500">
            この時点ではまだコメントがありません
          </div>
        ) : (
          visibleMessages.map((m) => <MessageItem key={m.id} message={m} />)
        )}
      </div>

      <div className="border-t border-bg-border bg-bg-panel px-3 py-2 text-[11px] text-neutral-400">
        過去配信のリプレイです。投稿はできません。
      </div>
    </div>
  );
}
