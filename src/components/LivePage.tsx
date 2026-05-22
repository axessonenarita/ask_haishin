"use client";

import { useCallback, useEffect, useState } from "react";
import type { Stream } from "@/lib/types";
import { useProfile } from "@/lib/useProfile";
import { Chat } from "./Chat";
import { ProfileSetup } from "./ProfileSetup";
import { StreamInfo } from "./StreamInfo";
import { VideoPlayer } from "./VideoPlayer";

type Props = { stream: Stream | null };

export function LivePage({ stream }: Props) {
  const { profile, loaded, save } = useProfile();
  const [playbackEnded, setPlaybackEnded] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);

  useEffect(() => {
    setPlaybackEnded(false);
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
    <div className="flex h-[100dvh] w-full flex-col bg-bg-base md:flex-row">
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
          <div className="max-h-[28vh] min-h-0 overflow-y-auto md:max-h-none md:flex-1">
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
            onProfileChange={save}
            chatExpanded={chatExpanded}
            onToggleExpand={toggleChatExpanded}
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
