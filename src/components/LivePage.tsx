"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Stream } from "@/lib/types";
import { useProfile } from "@/lib/useProfile";
import { Chat } from "./Chat";
import { ProfileSetup } from "./ProfileSetup";
import { VideoPlayer } from "./VideoPlayer";

export function LivePage() {
  const { profile, loaded, save } = useProfile();
  const [stream, setStream] = useState<Stream | null>(null);
  const [streamLoaded, setStreamLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await supabase
        .from("streams")
        .select("*")
        .neq("status", "ended")
        .order("start_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (active.data) {
        setStream(active.data as Stream);
        setStreamLoaded(true);
        return;
      }

      const ended = await supabase
        .from("streams")
        .select("*")
        .order("start_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      setStream((ended.data as Stream | null) ?? null);
      setStreamLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !streamLoaded) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-500">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-bg-base md:flex-row">
      <div className="w-full md:flex-1">
        <div className="flex h-[40vh] items-center justify-center bg-black md:h-full">
          <div className="w-full max-w-[1600px]">
            <VideoPlayer stream={stream} />
          </div>
        </div>
      </div>

      <div className="flex h-[60vh] w-full flex-col border-t border-bg-border md:h-full md:w-[380px] md:border-l md:border-t-0">
        {profile ? (
          <Chat profile={profile} onProfileChange={save} />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-sm text-neutral-400">
            ニックネームを設定するとチャットに参加できます。
          </div>
        )}
      </div>

      {!profile && (
        <ProfileSetup
          title="チャットに参加"
          submitLabel="参加する"
          onSubmit={save}
        />
      )}
    </div>
  );
}
