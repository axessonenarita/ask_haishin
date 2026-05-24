"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Message, Stream } from "@/lib/types";
import { ReplayChat } from "./ReplayChat";
import { ReplayPlayer } from "./ReplayPlayer";

type Props = { stream: Stream };

export function ReplayPage({ stream }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("stream_id", stream.id)
        .eq("deleted", false)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (cancelled) return;
      setMessages((data ?? []) as Message[]);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [stream.id]);

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-bg-base md:flex-row">
      <div className="flex w-full min-w-0 flex-col md:flex-1">
        <div className="shrink-0 bg-black">
          <div className="mx-auto w-full max-w-[1600px]">
            <ReplayPlayer stream={stream} onTimeUpdate={setCurrentTime} />
          </div>
        </div>
        <div className="max-h-[28vh] min-h-0 overflow-y-auto bg-bg-panel px-4 py-3 md:max-h-none md:flex-1">
          <div className="text-xs text-neutral-400">リプレイ</div>
          <h1 className="mt-1 text-base font-bold md:text-lg">{stream.title}</h1>
          <div className="mt-1 text-[11px] text-neutral-400">
            元の配信開始：
            {new Date(stream.start_at).toLocaleString("ja-JP")}
          </div>
          {stream.description && (
            <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-neutral-300">
              {stream.description}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col border-t border-bg-border md:h-full md:flex-none md:w-[380px] md:border-l md:border-t-0">
        {loaded ? (
          <ReplayChat
            stream={stream}
            messages={messages}
            currentTime={currentTime}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">
            チャットを読み込み中…
          </div>
        )}
      </div>
    </div>
  );
}
