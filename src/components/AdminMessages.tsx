"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AVATARS,
  COLORS,
  MAX_BODY_LENGTH,
  MAX_NICKNAME_LENGTH,
  ROLES,
  getAvatarEmoji,
  getColorHex,
  type Role,
} from "@/lib/constants";
import type { Message, Stream } from "@/lib/types";

type FormState = {
  nickname: string;
  avatar: string;
  color: string;
  role: Role;
  body: string;
  stream_id: string;
  pinned: boolean;
};

const initialForm: FormState = {
  nickname: "",
  avatar: AVATARS[0].id,
  color: COLORS[0].id,
  role: "admin",
  body: "",
  stream_id: "",
  pinned: false,
};

export function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/messages", { cache: "no-store" });
    if (!res.ok) {
      setError("読み込みに失敗しました");
      setLoading(false);
      return;
    }
    const json = (await res.json()) as { messages: Message[] };
    setMessages(json.messages);
    setLoading(false);
  }, []);

  const loadStreams = useCallback(async () => {
    const res = await fetch("/api/admin/streams", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { streams: Stream[] };
    setStreams(json.streams);
    setForm((f) => {
      if (f.stream_id) return f;
      const active = json.streams.find((s) => s.status !== "ended");
      const fallback = active ?? json.streams[0];
      return fallback ? { ...f, stream_id: fallback.id } : f;
    });
  }, []);

  useEffect(() => {
    void load();
    void loadStreams();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load, loadStreams]);

  const handlePost = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!form.nickname.trim() || !form.body.trim()) {
        setError("ニックネームと本文は必須です");
        return;
      }
      if (!form.stream_id) {
        setError("対象配信を選択してください");
        return;
      }
      setSubmitting(true);
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSubmitting(false);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "投稿に失敗しました");
        return;
      }
      setForm((f) => ({ ...f, body: "", pinned: false }));
      void load();
    },
    [form, load],
  );

  const handleTogglePinned = useCallback(
    async (id: string, next: boolean) => {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: next }),
      });
      if (!res.ok) {
        setError("更新に失敗しました");
        return;
      }
      void load();
    },
    [load],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("このコメントを削除しますか？")) return;
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("削除に失敗しました");
        return;
      }
      void load();
    },
    [load],
  );

  return (
    <>
      <section className="mb-8 rounded-lg bg-bg-panel p-4">
        <h2 className="mb-3 font-bold">運営 / STAFF コメント投稿</h2>
        <form onSubmit={handlePost} className="grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-neutral-300">対象配信</span>
            <select
              value={form.stream_id}
              onChange={(e) =>
                setForm({ ...form, stream_id: e.target.value })
              }
              className="w-full rounded-md bg-bg-input px-3 py-2 outline-none"
            >
              <option value="">— 配信を選択 —</option>
              {streams.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.status}] {s.title}（/live/{s.slug}）
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-neutral-300">ロール</span>
            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as Role })
              }
              className="w-full rounded-md bg-bg-input px-3 py-2 outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === "admin"
                    ? "運営 (admin)"
                    : r === "staff"
                    ? "STAFF"
                    : "一般 (user)"}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-neutral-300">ニックネーム</span>
            <input
              type="text"
              value={form.nickname}
              maxLength={MAX_NICKNAME_LENGTH}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className="w-full rounded-md bg-bg-input px-3 py-2 outline-none"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-neutral-300">アイコン</span>
            <select
              value={form.avatar}
              onChange={(e) => setForm({ ...form, avatar: e.target.value })}
              className="w-full rounded-md bg-bg-input px-3 py-2 outline-none"
            >
              {AVATARS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.id}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-neutral-300">カラー</span>
            <select
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="w-full rounded-md bg-bg-input px-3 py-2 outline-none"
            >
              {COLORS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.id})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-neutral-300">本文</span>
            <textarea
              value={form.body}
              maxLength={MAX_BODY_LENGTH}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={3}
              className="w-full rounded-md bg-bg-input px-3 py-2 outline-none"
            />
          </label>

          {(form.role === "admin" || form.role === "staff") && (
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) =>
                  setForm({ ...form, pinned: e.target.checked })
                }
                className="h-4 w-4 accent-blue-500"
              />
              <span className="text-neutral-300">
                このコメントを固定表示する(視聴ページ上部のお知らせ枠に出す)
              </span>
            </label>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 font-bold hover:bg-blue-500 disabled:opacity-50"
            >
              投稿する
            </button>
            {error && (
              <span className="ml-3 text-sm text-red-400">{error}</span>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-lg bg-bg-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">コメント一覧（最新200件）</h2>
          <button
            type="button"
            onClick={load}
            className="rounded-md bg-bg-input px-3 py-1 text-sm hover:bg-neutral-700"
          >
            再読込
          </button>
        </div>
        {loading ? (
          <div className="text-neutral-400">読み込み中…</div>
        ) : (
          <ul className="divide-y divide-bg-border lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
            {messages.map((m) => {
              const stream = streams.find((s) => s.id === m.stream_id);
              return (
              <li
                key={m.id}
                className={`flex items-start gap-3 py-2 ${
                  m.deleted ? "opacity-40" : ""
                }`}
              >
                <div className="flex-1 break-words text-sm">
                  <div className="text-[11px] text-neutral-500">
                    {new Date(m.created_at).toLocaleString("ja-JP")} ・ {m.role}
                    {stream && ` ・ ${stream.title}`}
                    {!stream && m.stream_id && " ・ (削除済み配信)"}
                    {!m.stream_id && " ・ (配信なし)"}
                    {m.deleted && " ・ 削除済み"}
                    {m.pinned && !m.deleted && (
                      <span className="ml-1 rounded bg-role-adminGold/30 px-1 text-[10px] font-bold text-role-adminGold">
                        固定中
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="mr-1">{getAvatarEmoji(m.avatar)}</span>
                    <span
                      className="font-bold"
                      style={{ color: getColorHex(m.color) }}
                    >
                      {m.nickname}
                    </span>
                    <span className="text-neutral-400">：</span>
                    <span>{m.body}</span>
                  </div>
                </div>
                {!m.deleted && (
                  <div className="flex shrink-0 flex-col gap-1">
                    {(m.role === "admin" || m.role === "staff") && (
                      <button
                        type="button"
                        onClick={() => handleTogglePinned(m.id, !m.pinned)}
                        className={`rounded-md px-2 py-1 text-xs ${
                          m.pinned
                            ? "bg-role-adminGold/30 text-role-adminGold hover:bg-role-adminGold/50"
                            : "bg-bg-input text-neutral-300 hover:bg-neutral-700"
                        }`}
                      >
                        {m.pinned ? "固定解除" : "固定する"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="rounded-md bg-red-600/20 px-2 py-1 text-xs text-red-300 hover:bg-red-600/40"
                    >
                      削除
                    </button>
                  </div>
                )}
              </li>
              );
            })}
            {messages.length === 0 && (
              <li className="py-2 text-neutral-400">コメントがありません</li>
            )}
          </ul>
        )}
      </section>
    </>
  );
}
