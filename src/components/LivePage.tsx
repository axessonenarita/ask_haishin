"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Stream } from "@/lib/types";
import { useProfile } from "@/lib/useProfile";
import { Chat } from "./Chat";
import { InAppBrowserNotice } from "./InAppBrowserNotice";
import { ProfileSetup } from "./ProfileSetup";
import { StreamInfo } from "./StreamInfo";
import { VideoPlayer } from "./VideoPlayer";

type Props = { stream: Stream | null };

export function LivePage({ stream: initialStream }: Props) {
  const { profile, loaded, save } = useProfile();
  const [stream, setStream] = useState<Stream | null>(initialStream);
  const [playbackEnded, setPlaybackEnded] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [vvDims, setVvDims] = useState<{
    height: number;
    offsetTop: number;
  } | null>(null);
  const [viewerCount, setViewerCount] = useState<number | null>(null);

  useEffect(() => {
    setStream(initialStream);
  }, [initialStream]);

  useEffect(() => {
    setPlaybackEnded(false);
  }, [stream?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setVvDims({ height: vv.height, offsetTop: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // body のスクロールを止めて、iOS Safari のキーボード展開時の
  // ページ全体上方シフトを防ぐ
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    const id = stream?.id;
    if (!id) return;

    const channel = supabase
      .channel(`stream-realtime-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "streams",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setStream(payload.new as Stream);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stream?.id]);

  // 視聴者カウント用: Realtime Presence チャネルに自分を track + 同チャネルから
  // 全体の count を購読する。管理画面側でも同じチャネルを購読して count を表示する。
  useEffect(() => {
    const id = stream?.id;
    if (!id) {
      setViewerCount(null);
      return;
    }

    const presenceKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const channel = supabase.channel(`presence-stream-${id}`, {
      config: { presence: { key: presenceKey } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setViewerCount(Object.keys(state).length);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ at: new Date().toISOString() });
      }
    });

    return () => {
      setViewerCount(null);
      void channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [stream?.id]);

  const handlePlaybackEnded = useCallback(() => {
    setPlaybackEnded(true);
  }, []);

  const toggleChatExpanded = useCallback(() => {
    setChatExpanded((v) => !v);
  }, []);

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-500">
        読み込み中…
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 flex w-full flex-col overflow-hidden bg-bg-base md:flex-row"
      style={
        vvDims
          ? {
              top: `${vvDims.offsetTop}px`,
              height: `${vvDims.height}px`,
            }
          : { top: 0, height: "100dvh" }
      }
    >
      <InAppBrowserNotice />
      <div
        className={`w-full min-w-0 flex-col md:flex md:flex-1 ${
          chatExpanded ? "hidden" : "flex"
        }`}
      >
        <div className="shrink-0 bg-black">
          <div className="mx-auto w-full max-w-[1600px]">
            <VideoPlayer
              stream={stream}
              playbackEnded={playbackEnded}
              onPlaybackEnded={handlePlaybackEnded}
            />
          </div>
        </div>
        {stream && (
          <div className="hidden md:block md:max-h-none md:min-h-0 md:flex-1 md:overflow-y-auto">
            <StreamInfo stream={stream} playbackEnded={playbackEnded} />
          </div>
        )}
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col border-t border-bg-border md:h-full md:flex-none md:w-[380px] md:border-l md:border-t-0">
        {!stream ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-neutral-400">
            配信が登録されていません
          </div>
        ) : profile ? (
          <Chat
            profile={profile}
            streamId={stream.id}
            stream={stream}
            playbackEnded={playbackEnded}
            onProfileChange={save}
            chatExpanded={chatExpanded}
            onToggleExpand={toggleChatExpanded}
            viewerCount={viewerCount}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-sm text-neutral-400">
            ニックネームを設定するとチャットに参加できます。
          </div>
        )}
      </div>

      {!profile && stream && (
        <ProfileSetup
          title="チャットに参加"
          submitLabel="参加する"
          onSubmit={save}
        />
      )}
    </div>
  );
}
