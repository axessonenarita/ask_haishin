"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FORK_COOLDOWN_MS, LS_KEYS } from "@/lib/constants";
import { supabase } from "@/lib/supabase/client";

type Props = { streamId: string };

function formatRemain(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function FloatingForkButton({ streamId }: Props) {
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const [pulse, setPulse] = useState(false);
  const [inputActive, setInputActive] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // localStorage からクールダウン復元
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(LS_KEYS.forkCooldownAt);
    if (!raw) return;
    const last = Number(raw);
    if (!Number.isFinite(last)) return;
    const until = last + FORK_COOLDOWN_MS;
    if (until > Date.now()) setCooldownUntil(until);
  }, []);

  // 1 秒おきに表示用 now を更新
  useEffect(() => {
    if (cooldownUntil <= 0) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [cooldownUntil]);

  // 入力欄(textarea / input)に focus が当たっている間はボタンを隠す
  useEffect(() => {
    if (typeof document === "undefined") return;
    const check = () => {
      const el = document.activeElement;
      if (!el) {
        setInputActive(false);
        return;
      }
      const tag = el.tagName;
      setInputActive(tag === "TEXTAREA" || tag === "INPUT");
    };
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    return () => {
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, []);

  // broadcast 用チャネルを subscribe (送信用)
  useEffect(() => {
    if (!streamId) return;
    const channel = supabase.channel(`fork-effects-${streamId}`, {
      config: { broadcast: { self: true } },
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const handlePress = useCallback(() => {
    if (cooldownUntil > Date.now()) return;
    try {
      const audio = new Audio("/sounds/fork.mp3");
      audio.volume = 1;
      void audio.play().catch(() => {});
    } catch {
      // 無視
    }
    const pressedAt = Date.now();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_KEYS.forkCooldownAt, String(pressedAt));
    }
    setCooldownUntil(pressedAt + FORK_COOLDOWN_MS);
    setNow(pressedAt);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 600);
    const ch = channelRef.current;
    if (ch) {
      void ch.send({
        type: "broadcast",
        event: "fork_pressed",
        payload: { at: pressedAt },
      });
    }
  }, [cooldownUntil]);

  const remain = cooldownUntil - now;
  const isCoolingDown = remain > 0;

  if (inputActive) return null;

  return (
    <button
      type="button"
      onClick={handlePress}
      disabled={isCoolingDown}
      aria-label={isCoolingDown ? `音叉クールダウン残り ${formatRemain(remain)}` : "音叉を鳴らす"}
      className={`fixed right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors ${
        isCoolingDown
          ? "cursor-not-allowed bg-neutral-700 text-neutral-400"
          : "bg-amber-600 text-white hover:bg-amber-500 active:scale-95"
      } ${pulse ? "ring-4 ring-amber-300/70" : ""}`}
      style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
    >
      {isCoolingDown ? (
        <span className="font-mono text-[11px] font-bold">
          {formatRemain(remain)}
        </span>
      ) : (
        <span className="text-2xl" aria-hidden>
          🔔
        </span>
      )}
    </button>
  );
}
