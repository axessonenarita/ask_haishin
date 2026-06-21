"use client";

import * as Sentry from "@sentry/nextjs";
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
import {
  VIEWER_COUNT_CONFIG,
  inflateViewerCount,
} from "@/lib/viewerCount";
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
  viewerCount?: number | null;
};

export function Chat({
  profile,
  streamId,
  stream,
  playbackEnded,
  onProfileChange,
  viewerCount,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dismissedAdminId, setDismissedAdminId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [chatHidden, setChatHidden] = useState(false);
  const [exitState, setExitState] = useState<
    "idle" | "confirming" | "fallback"
  >("idle");
  const [overlayDims, setOverlayDims] = useState<{
    top: number;
    height: number;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const shouldScrollOnUpdateRef = useRef(false);
  // 最新メッセージの created_at を ref で保持(タブ復帰時の差分 fetch 用)
  const latestCreatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setOverlayDims({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // 視聴者数のかさ増し係数: stream の設定があればそれを優先、無ければデフォルト
  const inflationConfig = useMemo(
    () => ({
      boostStart:
        stream?.inflation_boost_start ?? VIEWER_COUNT_CONFIG.boostStart,
      realMax: stream?.inflation_real_max ?? VIEWER_COUNT_CONFIG.realMax,
      targetMax:
        stream?.inflation_target_max ?? VIEWER_COUNT_CONFIG.targetMax,
    }),
    [
      stream?.inflation_boost_start,
      stream?.inflation_real_max,
      stream?.inflation_target_max,
    ],
  );

  // pinned された admin/staff コメントだけを上部のお知らせバナーに出す
  const latestAdminMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (
        m.pinned &&
        !m.deleted &&
        (m.role === "admin" || m.role === "staff")
      ) {
        return m;
      }
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

  // 最新メッセージの created_at を ref に同期
  useEffect(() => {
    if (messages.length > 0) {
      latestCreatedAtRef.current = messages[messages.length - 1].created_at;
    }
  }, [messages]);

  // Realtime 取りこぼし対策: 最新の created_at より新しいメッセージを
  // fetch してリストに追加する共通処理。
  // - タブ復帰時 (visibilitychange)
  // - 30 秒ごとの周期ポーリング(セーフティネット)
  // - Realtime チャネルが切れた瞬間
  // から呼ばれる
  const fetchMissingMessages = useCallback(async () => {
    const since = latestCreatedAtRef.current;
    let query = supabase
      .from("messages")
      .select("*")
      .eq("deleted", false)
      .eq("stream_id", streamId);
    if (since) {
      query = query.gt("created_at", since);
    }
    const { data } = await query
      .order("created_at", { ascending: true })
      .limit(INITIAL_LOAD_LIMIT);
    if (!data || data.length === 0) return;

    const wasAtBottom = isNearBottom();
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newOnes = (data as Message[]).filter(
        (m) => !existingIds.has(m.id),
      );
      if (newOnes.length === 0) return prev;
      if (wasAtBottom) {
        shouldScrollOnUpdateRef.current = true;
      } else {
        setUnreadCount((c) => c + newOnes.length);
      }
      return [...prev, ...newOnes];
    });
  }, [streamId, isNearBottom]);

  // タブ復帰時に Realtime で取りこぼした分を fetch して追加
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void fetchMissingMessages();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchMissingMessages]);

  // 30 秒ごとの周期ポーリング(Realtime が静かに死んでた時のセーフティネット)
  // タブが hidden の時は走らせない(リソース節約)
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      void fetchMissingMessages();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMissingMessages]);

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
    latestCreatedAtRef.current = null;

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
      .subscribe((status) => {
        // チャネルが切れた瞬間に Sentry に通知 & 取りこぼしを fetch
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          Sentry.captureMessage(`Realtime channel ${status}`, {
            level: "warning",
            tags: { stream_id: streamId },
          });
          void fetchMissingMessages();
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [streamId, isNearBottom, fetchMissingMessages]);

  const submitMessage = useCallback(async () => {
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
    // 送信後はオーバーレイを閉じて動画視聴に戻す
    // 一部ブラウザ(Vivaldi 等)で blur() が反映されない / onBlur が
    // 発火しないことがあるので、state も明示的に false にする
    inputRef.current?.blur();
    setInputFocused(false);
  }, [body, profile, streamId, isNearBottom]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void submitMessage();
    },
    [submitMessage],
  );

  return (
    <>
      {/* 通常チャット(常時レンダリング、オーバーレイ時は背後でブラーされる) */}
      <div className="flex h-full flex-col bg-bg-panel">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-bg-border bg-bg-panel px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {viewerCount !== null &&
              viewerCount !== undefined &&
              viewerCount > 0 && (
                <span className="shrink-0 text-[11px] text-neutral-300">
                  👥{" "}
                  <span className="tabular-nums font-bold">
                    {inflateViewerCount(
                      viewerCount,
                      inflationConfig,
                    ).toLocaleString()}
                  </span>{" "}
                  人視聴中
                </span>
              )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setChatHidden((v) => !v)}
              className={`rounded-md px-2 py-1 text-xs hover:bg-neutral-700 ${
                chatHidden
                  ? "bg-blue-600/30 text-blue-200"
                  : "bg-bg-input text-neutral-300"
              }`}
              aria-label={
                chatHidden ? "コメントを表示" : "コメントを非表示"
              }
            >
              {chatHidden ? "コメント表示" : "コメント非表示"}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="rounded-md bg-bg-input px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
            >
              設定
            </button>
            <button
              type="button"
              onClick={() => {
                trackEvent("exit_click", { stream_id: streamId });
                inputRef.current?.blur();
                setInputFocused(false);
                setExitState("confirming");
              }}
              className="rounded-md bg-red-900/40 px-2 py-1 text-xs font-bold text-red-300 hover:bg-red-900/70"
            >
              退出
            </button>
          </div>
        </div>

        {chatHidden ? (
          <div className="flex flex-1 items-center justify-center bg-bg-panel/40 p-4 text-center text-xs text-neutral-500">
            コメントは非表示です。
            <br className="md:hidden" />
            上の「コメント表示」で再表示できます。
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-bg-border bg-bg-panel px-3 py-2">
              <button
                type="button"
                onClick={() => inputRef.current?.focus()}
                disabled={inputFocused}
                aria-hidden={inputFocused}
                tabIndex={inputFocused ? -1 : 0}
                className="w-full rounded-full bg-bg-input px-4 py-2 text-left text-sm text-neutral-400 hover:bg-neutral-700 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-bg-input"
              >
                配信にコメントを送ろう!
              </button>
            </div>

            {error && !inputFocused && (
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
                    <span className="text-neutral-100">
                      {latestAdminMessage.body}
                    </span>
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
          </>
        )}
      </div>

      {/* キーボード直上に貼り付く入力欄(透明オーバーレイの底だけが見える) */}
      <div
        className={
          inputFocused
            ? "pointer-events-none fixed inset-x-0 z-50 flex flex-col justify-end"
            : "pointer-events-none fixed -left-[9999px] top-0 h-0 w-0 overflow-hidden opacity-0"
        }
        style={
          inputFocused && overlayDims
            ? { top: `${overlayDims.top}px`, height: `${overlayDims.height}px` }
            : undefined
        }
        aria-hidden={!inputFocused}
      >
        {error && inputFocused && (
          <div className="pointer-events-auto shrink-0 border-y border-red-900 bg-red-950/90 px-3 py-1.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <form
          id="chat-form"
          onSubmit={handleSubmit}
          onMouseDown={(e) => {
            // 入力欄やボタン以外のエリアをタップしても input から focus が
            // 外れないようにする(iOS のデフォルト挙動の打ち消し)
            const target = e.target as HTMLElement;
            const tag = target.tagName;
            if (
              tag !== "INPUT" &&
              tag !== "BUTTON" &&
              tag !== "TEXTAREA" &&
              !target.closest("button")
            ) {
              e.preventDefault();
            }
          }}
          className="pointer-events-auto flex items-end gap-2 border-t border-bg-border bg-bg-panel px-2 py-2 shadow-lg"
        >
          <button
            type="button"
            onClick={() => {
              // 一部ブラウザで blur() だけだと onBlur が発火しないので
              // state を直接落としてオーバーレイを確実に閉じる
              inputRef.current?.blur();
              setInputFocused(false);
            }}
            className="shrink-0 rounded-md bg-bg-input px-3 py-2 text-sm font-bold text-neutral-300 hover:bg-neutral-700"
            aria-label="閉じる"
          >
            ✕
          </button>
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => {
              // 連続改行(空行)を 1 つの改行に潰す。貼り付け対策も兼ねる
              const next = e.target.value.replace(/\n{2,}/g, "\n");
              setBody(next);
            }}
            onKeyDown={(e) => {
              // 末尾が改行のときに Enter を押しても連打不可
              if (e.key === "Enter" && !e.shiftKey) {
                if (body.endsWith("\n") || body.length === 0) {
                  e.preventDefault();
                }
              }
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            maxLength={MAX_BODY_LENGTH}
            rows={1}
            placeholder="配信にコメントを送ろう!"
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-md bg-bg-input px-3 py-2 text-sm leading-relaxed text-white outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sending}
            tabIndex={inputFocused ? 0 : -1}
          />
          <button
            type="submit"
            onMouseDown={(e) => e.preventDefault()}
            disabled={sending || !sanitizeBody(body)}
            className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            送信
          </button>
        </form>
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

      {exitState !== "idle" && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl bg-bg-panel p-6 shadow-2xl">
            {exitState === "confirming" ? (
              <>
                <h2
                  id="exit-dialog-title"
                  className="mb-3 text-base font-bold text-neutral-100"
                >
                  配信から退出しますか?
                </h2>
                <p className="mb-5 text-sm text-neutral-300">
                  視聴を終了して、このタブを閉じます。
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      trackEvent("exit_cancel", { stream_id: streamId });
                      setExitState("idle");
                    }}
                    className="rounded-md bg-bg-input px-4 py-2 text-sm font-bold text-neutral-200 hover:bg-neutral-700"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      trackEvent("exit_confirm", { stream_id: streamId });
                      try {
                        window.close();
                      } catch {
                        // 一部環境で例外を投げることがあるので捕まえる
                      }
                      setExitState("fallback");
                    }}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
                  >
                    退出する
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2
                  id="exit-dialog-title"
                  className="mb-3 text-base font-bold text-neutral-100"
                >
                  ご視聴ありがとうございました
                </h2>
                <p className="mb-5 text-sm leading-relaxed text-neutral-300">
                  ブラウザの ✕ (タブを閉じる)、またはアプリの戻るボタンで
                  終了してください。
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      trackEvent("exit_fallback_back", {
                        stream_id: streamId,
                      });
                      setExitState("idle");
                    }}
                    className="rounded-md bg-bg-input px-4 py-2 text-sm font-bold text-neutral-200 hover:bg-neutral-700"
                  >
                    配信に戻る
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
