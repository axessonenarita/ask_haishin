"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";
import {
  INITIAL_LOAD_LIMIT,
  LS_KEYS,
  MAX_BODY_LENGTH,
  RATE_LIMIT_MS,
} from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";
import { containsBannedWord, sanitizeBody } from "@/lib/validation";
import type { Message, Stream, UserProfile } from "@/lib/types";
import { MessageItem } from "./MessageItem";
import { ProfileSetup } from "./ProfileSetup";
import { StreamInfo } from "./StreamInfo";

const NEAR_BOTTOM_THRESHOLD_PX = 80;

type Props = {
  profile: UserProfile;
  streamId: string;
  stream?: Stream | null;
  playbackEnded?: boolean;
  onProfileChange: (p: UserProfile) => void;
  chatExpanded?: boolean;
  onToggleExpand?: () => void;
};

export function Chat({
  profile,
  streamId,
  stream,
  playbackEnded,
  onProfileChange,
  chatExpanded,
  onToggleExpand,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dismissedAdminId, setDismissedAdminId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const shouldScrollOnUpdateRef = useRef(false);

  const latestAdminMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "admin" && !m.deleted) return m;
    }
    return null;
  }, [messages]);

  const showAdminBanner =
    latestAdminMessage !== null && latestAdminMessage.id !== dismissedAdminId;

  const isNearBottom = useCallback((): boolean => {
    const el = listRef.current;
    if (!el) return true;
    return (
      el.scrollHeight - el.scrollTop - el.clientHeight <=
      NEAR_BOTTOM_THRESHOLD_PX
    );
  }, []);

  const performScrollToBottom = useCallback(() => {
    const bottom = bottomSentinelRef.current;
    const list = listRef.current;
    if (bottom) {
      bottom.scrollIntoView({ block: "end", behavior: "auto" });
    } else if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, []);

  useLayoutEffect(() => {
    if (!shouldScrollOnUpdateRef.current) return;
    shouldScrollOnUpdateRef.current = false;
    performScrollToBottom();
    requestAnimationFrame(performScrollToBottom);
    setUnreadCount(0);
  }, [messages, performScrollToBottom]);

  const jumpToBottom = useCallback(() => {
    performScrollToBottom();
    requestAnimationFrame(performScrollToBottom);
    setUnreadCount(0);
  }, [performScrollToBottom]);

  const handleScroll = useCallback(() => {
    if (isNearBottom()) {
      setUnreadCount(0);
    }
  }, [isNearBottom]);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setUnreadCount(0);
    setDismissedAdminId(null);

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
      shouldScrollOnUpdateRef.current = true;
      setMessages(list);
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
          const wasAtBottom = isNearBottom();
          if (wasAtBottom) {
            shouldScrollOnUpdateRef.current = true;
          } else {
            setUnreadCount((c) => c + 1);
          }
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
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
  }, [streamId, isNearBottom]);

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

      const wasAtBottom = isNearBottom();
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
      trackEvent("message_post", { stream_id: streamId });
      if (wasAtBottom) {
        shouldScrollOnUpdateRef.current = true;
      }
    },
    [body, profile, streamId, isNearBottom],
  );

  return (
    <div className="flex h-full flex-col bg-bg-panel">
      <div className="flex shrink-0 items-center justify-between border-b border-bg-border px-3 py-2">
        <div className="text-sm font-bold text-neutral-200">ライブチャット</div>
        <div className="flex items-center gap-2">
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="rounded-md bg-bg-input px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 md:hidden"
              aria-label={chatExpanded ? "チャットを縮小" : "チャットを拡大"}
            >
              {chatExpanded ? "縮小" : "拡大"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="rounded-md bg-bg-input px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
          >
            設定変更
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 gap-2 border-b border-bg-border bg-bg-panel px-2 py-2"
      >
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
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

      {error && (
        <div className="shrink-0 border-b border-red-900 bg-red-950/40 px-3 py-1.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {showAdminBanner && latestAdminMessage && (
        <div className="flex shrink-0 items-start gap-2 border-b border-role-adminGold/40 bg-role-adminGold/10 px-3 py-2">
          <div className="min-w-0 flex-1 break-words text-sm">
            <div className="mb-0.5 text-[10px] font-bold text-role-adminGold">
              運営からのお知らせ
            </div>
            <div>
              <span className="mr-1">{latestAdminMessage.nickname}</span>
              <span className="text-neutral-400">：</span>
              <span className="text-neutral-100">{latestAdminMessage.body}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedAdminId(latestAdminMessage.id)}
            className="shrink-0 rounded p-1 text-neutral-300 hover:bg-white/10"
            aria-label="お知らせを閉じる"
          >
            ✕
          </button>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="chat-scroll absolute inset-0 overflow-y-auto pt-2 pb-4"
        >
          {stream && (
            <div className="border-b border-bg-border md:hidden">
              <StreamInfo stream={stream} playbackEnded={playbackEnded} />
            </div>
          )}
          <div className="px-3 pt-2 pb-2 text-[11px] leading-snug text-neutral-400">
            ニックネームで参加できます。ログインは不要です。
            <br />
            荒らし・なりすまし・不適切投稿は運営判断で削除します。
          </div>
          {messages.map((m) => (
            <MessageItem key={m.id} message={m} />
          ))}
          <div ref={bottomSentinelRef} aria-hidden className="h-1" />
        </div>

        {unreadCount > 0 && !inputFocused && (
          <button
            type="button"
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-blue-500"
          >
            ↓ 新着 {unreadCount}件
          </button>
        )}
      </div>

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
