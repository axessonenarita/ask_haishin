"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  INITIAL_LOAD_LIMIT,
  LS_KEYS,
  MAX_BODY_LENGTH,
  RATE_LIMIT_MS,
} from "@/lib/constants";
import { containsBannedWord, sanitizeBody } from "@/lib/validation";
import type { Message, UserProfile } from "@/lib/types";
import { MessageItem } from "./MessageItem";
import { ProfileSetup } from "./ProfileSetup";

type Props = {
  profile: UserProfile;
  streamId: string;
  onProfileChange: (p: UserProfile) => void;
};

export function Chat({ profile, streamId, onProfileChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);

    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("deleted", false)
        .eq("stream_id", streamId)
        .order("created_at", { ascending: false })
        .limit(INITIAL_LOAD_LIMIT);

      if (cancelled) return;
      if (error) {
        setError("コメントの読み込みに失敗しました");
        return;
      }
      const list = (data ?? []).slice().reverse() as Message[];
      setMessages(list);
      setTimeout(scrollToBottom, 0);
    })();

    const channel = supabase
      .channel(`messages-realtime-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          if (m.deleted) return;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
          setTimeout(scrollToBottom, 0);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) =>
            m.deleted
              ? prev.filter((x) => x.id !== m.id)
              : prev.map((x) => (x.id === m.id ? m : x)),
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [scrollToBottom, streamId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmed = sanitizeBody(body);
      if (!trimmed) return;

      if (containsBannedWord(trimmed)) {
        setError("不適切な表現が含まれています");
        return;
      }

      const lastStr = localStorage.getItem(LS_KEYS.lastPostAt);
      const last = lastStr ? Number(lastStr) : 0;
      const now = Date.now();
      if (now - last < RATE_LIMIT_MS) {
        const wait = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
        setError(`連投はできません（あと${wait}秒）`);
        return;
      }

      setSending(true);
      const { error: insertError } = await supabase.from("messages").insert({
        nickname: profile.nickname,
        avatar: profile.avatar,
        color: profile.color,
        body: trimmed,
        role: "user",
        deleted: false,
        stream_id: streamId,
      });
      setSending(false);

      if (insertError) {
        setError("投稿に失敗しました");
        return;
      }

      localStorage.setItem(LS_KEYS.lastPostAt, String(now));
      setBody("");
    },
    [body, profile, streamId],
  );

  return (
    <div className="flex h-full flex-col bg-bg-panel">
      <div className="flex items-center justify-between border-b border-bg-border px-3 py-2">
        <div className="text-sm font-bold text-neutral-200">ライブチャット</div>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="rounded-md bg-bg-input px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
        >
          設定変更
        </button>
      </div>

      <div className="border-b border-bg-border px-3 py-2 text-[11px] leading-snug text-neutral-400">
        ニックネームで参加できます。ログインは不要です。
        <br />
        荒らし・なりすまし・不適切投稿は運営判断で削除します。
      </div>

      <div
        ref={listRef}
        className="chat-scroll flex-1 overflow-y-auto py-2"
      >
        {messages.map((m) => (
          <MessageItem key={m.id} message={m} />
        ))}
      </div>

      {error && (
        <div className="border-t border-red-900 bg-red-950/40 px-3 py-1.5 text-xs text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-bg-border bg-bg-panel p-2"
      >
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_BODY_LENGTH}
          placeholder="コメントを入力"
          className="flex-1 rounded-md bg-bg-input px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !sanitizeBody(body)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          送信
        </button>
      </form>

      {showSettings && (
        <ProfileSetup
          title="設定変更"
          submitLabel="保存"
          initial={profile}
          onSubmit={(p) => {
            onProfileChange(p);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
