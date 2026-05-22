"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";

function generatePresenceKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useStreamPresence(streamId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!streamId) {
      setCount(0);
      return;
    }

    const presenceKey = generatePresenceKey();
    const channel = supabase.channel(`stream-presence:${streamId}`, {
      config: { presence: { key: presenceKey } },
    });

    const updateCount = () => {
      const state = channel.presenceState();
      setCount(Object.keys(state).length);
    };

    channel
      .on("presence", { event: "sync" }, updateCount)
      .on("presence", { event: "join" }, updateCount)
      .on("presence", { event: "leave" }, updateCount)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
        }
      });

    return () => {
      void channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [streamId]);

  return count;
}
