"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  AVATARS,
  COLORS,
  MAX_BODY_LENGTH,
  MAX_NICKNAME_LENGTH,
  type Role,
} from "@/lib/constants";
import type { Stream, StreamStatus } from "@/lib/types";
import {
  VIEWER_COUNT_CONFIG,
  inflateViewerCount,
} from "@/lib/viewerCount";
import { HlsPreview } from "./HlsPreview";

const STATUSES: StreamStatus[] = ["waiting", "live", "ended"];

const STATUS_LABEL: Record<StreamStatus, string> = {
  waiting: "開始前",
  live: "配信中",
  ended: "終了",
};

const STATUS_BADGE: Record<StreamStatus, string> = {
  waiting: "bg-neutral-700 text-neutral-100",
  live: "bg-red-600 text-white",
  ended: "bg-neutral-800 text-neutral-400",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

function defaultStartLocal(): string {
  const now = new Date();
  const d = new Date(now);
  d.setHours(21, 10, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 1);
  }
  return isoToLocalInput(d.toISOString());
}

type FormState = {
  title: string;
  description: string;
  startLocal: string;
  hls_url: string;
  status: StreamStatus;
};

const emptyForm = (): FormState => ({
  title: "",
  description: "",
  startLocal: defaultStartLocal(),
  hls_url: "",
  status: "waiting",
});

export function AdminStreams() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [previewNewHls, setPreviewNewHls] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/streams", { cache: "no-store" });
    if (!res.ok) {
      setError("読み込みに失敗しました");
      setLoading(false);
      return;
    }
    const json = (await res.json()) as { streams: Stream[] };
    setStreams(json.streams);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeStream = useMemo(() => {
    const active = streams
      .filter((s) => s.status !== "ended")
      .sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      )[0];
    if (active) return active;
    return streams
      .slice()
      .sort(
        (a, b) =>
          new Date(b.start_at).getTime() - new Date(a.start_at).getTime(),
      )[0];
  }, [streams]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!form.title.trim()) {
        setError("タイトルは必須です");
        return;
      }
      if (!form.hls_url.trim()) {
        setError("HLS URL は必須です");
        return;
      }
      let start_at: string;
      try {
        start_at = localInputToIso(form.startLocal);
      } catch {
        setError("開始日時が不正です");
        return;
      }

      setSubmitting(true);
      const res = await fetch("/api/admin/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description,
          start_at,
          hls_url: form.hls_url.trim(),
          status: form.status,
        }),
      });
      setSubmitting(false);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "登録に失敗しました");
        return;
      }
      setForm(emptyForm());
      setShowCreateForm(false);
      void load();
    },
    [form, load],
  );

  const updateField = useCallback(
    async (id: string, patch: Partial<Stream>) => {
      const res = await fetch(`/api/admin/streams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "更新に失敗しました");
        return;
      }
      void load();
    },
    [load],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("この配信を削除しますか？")) return;
      const res = await fetch(`/api/admin/streams/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("削除に失敗しました");
        return;
      }
      void load();
    },
    [load],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">配信一覧</h2>
          <p className="text-xs text-neutral-500">
            登録されている配信 {streams.length} 件
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-md bg-bg-input px-3 py-1.5 text-xs hover:bg-neutral-700"
            aria-label="再読込"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-bold hover:bg-blue-500"
          >
            {showCreateForm ? "× 閉じる" : "+ 新規配信"}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-lg border border-bg-border bg-bg-panel p-4 md:grid-cols-2"
        >
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-neutral-400">
              タイトル<span className="text-red-400"> *</span>
            </span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例：5月22日 配信"
              className="w-full rounded-md bg-bg-input px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-neutral-400">
              概要(任意)
            </span>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              placeholder="本日の配信内容、テーマ、注意事項など"
              className="w-full rounded-md bg-bg-input px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs text-neutral-400">
              開始日時(端末ローカル)
            </span>
            <input
              type="datetime-local"
              value={form.startLocal}
              onChange={(e) => setForm({ ...form, startLocal: e.target.value })}
              className="w-full rounded-md bg-bg-input px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs text-neutral-400">
              初期ステータス
            </span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as StreamStatus })
              }
              className="w-full rounded-md bg-bg-input px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-neutral-400">
              HLS URL (m3u8)<span className="text-red-400"> *</span>
            </span>
            <input
              type="url"
              value={form.hls_url}
              onChange={(e) => setForm({ ...form, hls_url: e.target.value })}
              placeholder="https://vz-xxxxxxxx.b-cdn.net/<video-guid>/playlist.m3u8"
              className="w-full rounded-md bg-bg-input px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewNewHls((v) => !v)}
                disabled={!form.hls_url.trim()}
                className="rounded bg-bg-input px-2 py-1 text-[11px] text-neutral-200 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {previewNewHls ? "▼ プレビューを閉じる" : "▶ プレビュー"}
              </button>
              <span className="text-[10px] text-neutral-500">
                入力した URL を実際に再生して確認できます
              </span>
            </div>
            {previewNewHls && (
              <div className="mt-2 max-w-md">
                <HlsPreview url={form.hls_url} />
              </div>
            )}
          </label>

          <div className="flex items-center gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
            >
              登録
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setForm(emptyForm());
                setError(null);
              }}
              className="rounded-md bg-bg-input px-3 py-2 text-sm hover:bg-neutral-700"
            >
              キャンセル
            </button>
            {error && (
              <span className="text-sm text-red-400">{error}</span>
            )}
          </div>
        </form>
      )}

      {error && !showCreateForm && (
        <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-bg-border bg-bg-panel p-6 text-center text-sm text-neutral-400">
          読み込み中…
        </div>
      ) : streams.length === 0 ? (
        <div className="rounded-lg border border-bg-border bg-bg-panel p-6 text-center text-sm text-neutral-400">
          配信が登録されていません
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {streams.map((s) => (
            <StreamCard
              key={s.id}
              stream={s}
              isActive={activeStream?.id === s.id}
              onUpdate={(patch) => updateField(s.id, patch)}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </ul>
      )}

      <p className="text-[11px] text-neutral-500">
        視聴ページ
        <code className="mx-1 rounded bg-bg-input px-1 text-neutral-300">/</code>
        では「終了していない配信のうち開始日時が最も近いもの」を表示します。
      </p>
    </div>
  );
}

function StreamCard({
  stream: s,
  isActive,
  onUpdate,
  onDelete,
}: {
  stream: Stream;
  isActive: boolean;
  onUpdate: (patch: Partial<Stream>) => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`rounded-lg border border-bg-border bg-bg-panel p-4 ${
        s.status === "ended" ? "opacity-70" : ""
      }`}
    >
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[s.status]}`}
            >
              {STATUS_LABEL[s.status]}
            </span>
            {isActive && s.status !== "ended" && (
              <span className="rounded bg-blue-600/20 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                現在配信
              </span>
            )}
            <h3 className="text-sm font-bold leading-tight">{s.title}</h3>
          </div>
          <div className="text-xs text-neutral-400">
            {new Date(s.start_at).toLocaleString("ja-JP")}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <select
            value={s.status}
            onChange={(e) =>
              onUpdate({ status: e.target.value as StreamStatus })
            }
            className="rounded-md bg-bg-input px-2 py-1 text-xs"
            aria-label="ステータス変更"
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABEL[st]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md bg-red-600/20 px-2 py-1 text-xs text-red-300 hover:bg-red-600/40"
          >
            削除
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <StreamUrl slug={s.slug} />
          <div className="break-all text-[10px] text-neutral-500">
            <span className="text-neutral-600">HLS:</span> {s.hls_url}
          </div>
        </div>
        <ViewerCount stream={s} />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <DescriptionEditor stream={s} onChange={onUpdate} />
        <InflationEditor stream={s} onChange={onUpdate} />
      </div>

      <div className="mt-2">
        <HlsPreviewSection url={s.hls_url} />
      </div>

      <div className="mt-2">
        <StreamCommentPoster stream={s} />
      </div>
    </li>
  );
}

type PosterForm = {
  nickname: string;
  avatar: string;
  color: string;
  role: Role;
  body: string;
  pinned: boolean;
};

const POSTER_INITIAL: PosterForm = {
  nickname: "編集",
  avatar: "owl",
  color: COLORS[0].id,
  role: "admin",
  body: "",
  pinned: false,
};

function StreamCommentPoster({ stream }: { stream: Stream }) {
  const [form, setForm] = useState<PosterForm>(POSTER_INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successAt, setSuccessAt] = useState<number | null>(null);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.nickname.trim() || !form.body.trim()) {
      setError("ニックネームと本文は必須です");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: form.nickname.trim(),
        avatar: form.avatar,
        color: form.color,
        role: form.role,
        body: form.body,
        pinned: form.pinned,
        stream_id: stream.id,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "投稿に失敗しました");
      return;
    }
    setForm((f) => ({ ...f, body: "", pinned: false }));
    setSuccessAt(Date.now());
  };

  const recentlySent =
    successAt !== null && Date.now() - successAt < 3000;

  return (
    <details className="rounded-md border border-bg-border bg-bg-input/40">
      <summary className="cursor-pointer rounded-md px-3 py-2 text-[11px] font-bold text-neutral-200 hover:bg-bg-input/60">
        💬 この配信に運営コメントを投稿
        {recentlySent && (
          <span className="ml-2 rounded bg-green-600/30 px-1.5 py-0.5 text-[10px] text-green-300">
            ✓ 投稿しました
          </span>
        )}
      </summary>
      <form onSubmit={handlePost} className="grid gap-2 border-t border-bg-border p-3 text-xs">
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-neutral-400">ロール</span>
            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as Role })
              }
              className="rounded bg-bg-input px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="admin">運営</option>
              <option value="staff">STAFF</option>
              <option value="user">一般</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-neutral-400">アイコン</span>
            <select
              value={form.avatar}
              onChange={(e) => setForm({ ...form, avatar: e.target.value })}
              className="rounded bg-bg-input px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            >
              {AVATARS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-neutral-400">カラー</span>
            <select
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="rounded bg-bg-input px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            >
              {COLORS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-neutral-400">ニックネーム</span>
          <input
            type="text"
            value={form.nickname}
            maxLength={MAX_NICKNAME_LENGTH}
            onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            className="rounded bg-bg-input px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-neutral-400">本文</span>
          <textarea
            value={form.body}
            maxLength={MAX_BODY_LENGTH}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={2}
            placeholder="運営からのコメントを入力"
            className="rounded bg-bg-input px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {(form.role === "admin" || form.role === "staff") && (
          <label className="flex items-center gap-2 text-[11px] text-neutral-300">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) =>
                setForm({ ...form, pinned: e.target.checked })
              }
              className="h-3.5 w-3.5 accent-blue-500"
            />
            このコメントを固定表示する(上部のお知らせ枠に出す)
          </label>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "送信中…" : "投稿"}
          </button>
          {error && (
            <span className="text-[11px] text-red-400">{error}</span>
          )}
        </div>

        <p className="text-[10px] text-neutral-500">
          投稿先: <span className="text-neutral-300">{stream.title}</span> /
          stream_id: <code className="rounded bg-bg-input px-1">{stream.id.slice(0, 8)}</code>
        </p>
      </form>
    </details>
  );
}

function HlsPreviewSection({ url }: { url: string }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="rounded-md border border-bg-border bg-bg-input/40 px-3 py-2"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-[11px] text-neutral-300">
        ▶ 再生プレビュー
        <span className="ml-2 text-[10px] text-neutral-500">
          (開くと HLS を読み込み)
        </span>
      </summary>
      {open && (
        <div className="mt-2 max-w-md">
          <HlsPreview url={url} />
        </div>
      )}
    </details>
  );
}

function DescriptionEditor({
  stream,
  onChange,
}: {
  stream: Stream;
  onChange: (patch: Partial<Stream>) => void;
}) {
  const [value, setValue] = useState(stream.description ?? "");

  useEffect(() => {
    setValue(stream.description ?? "");
  }, [stream.description]);

  const dirty = value !== (stream.description ?? "");

  return (
    <details className="rounded-md border border-bg-border bg-bg-input/40 px-3 py-2">
      <summary className="cursor-pointer text-[11px] text-neutral-300">
        概要を編集
        {stream.description && (
          <span className="ml-2 text-neutral-500">
            ({stream.description.length} 文字)
          </span>
        )}
      </summary>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="本日の配信内容、テーマ、注意事項など。URL は自動でリンク化されます。"
        className="mt-2 w-full rounded bg-bg-input px-2 py-1.5 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ description: value })}
          disabled={!dirty}
          className="rounded bg-blue-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          保存
        </button>
        <button
          type="button"
          onClick={() => setValue(stream.description ?? "")}
          disabled={!dirty}
          className="rounded bg-bg-input px-3 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          リセット
        </button>
        {dirty && (
          <span className="text-[10px] text-amber-400">未保存の変更あり</span>
        )}
      </div>
    </details>
  );
}

function StreamUrl({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/live/${slug}`;
  const href =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-neutral-500">視聴URL</span>
      <a
        href={path}
        target="_blank"
        rel="noreferrer"
        className="break-all text-blue-400 hover:underline"
      >
        {path}
      </a>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded bg-bg-input px-2 py-0.5 text-[10px] hover:bg-neutral-700"
      >
        {copied ? "✓ コピー済" : "コピー"}
      </button>
    </div>
  );
}

function ViewerCount({ stream }: { stream: Stream }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const channel = supabase.channel(`presence-stream-${stream.id}`, {
      config: {
        presence: {
          key: `admin-observer-${Date.now()}-${Math.random()}`,
        },
      },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setCount(Object.keys(state).length);
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stream.id]);

  const config = {
    boostStart:
      stream.inflation_boost_start ?? VIEWER_COUNT_CONFIG.boostStart,
    realMax: stream.inflation_real_max ?? VIEWER_COUNT_CONFIG.realMax,
    targetMax:
      stream.inflation_target_max ?? VIEWER_COUNT_CONFIG.targetMax,
  };
  const inflated =
    count === null ? null : inflateViewerCount(count, config);
  const ratio =
    count === null || count === 0 || inflated === null
      ? null
      : inflated / count;

  return (
    <div className="flex shrink-0 items-stretch gap-px overflow-hidden rounded-md bg-bg-input/40">
      <div className="flex items-center gap-2 bg-blue-600/15 px-3 py-1.5">
        <span className="text-lg">👥</span>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-blue-300">
            視聴者表示
          </span>
          <span className="text-base font-bold leading-none text-blue-200 tabular-nums">
            {inflated === null ? "—" : inflated.toLocaleString()}
            <span className="ml-0.5 text-[10px] font-normal text-blue-300">
              人
            </span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-neutral-600/15 px-3 py-1.5">
        <span className="text-lg opacity-70">🔍</span>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-neutral-400">
            実数
          </span>
          <span className="text-base font-bold leading-none text-neutral-200 tabular-nums">
            {count === null ? "—" : count.toLocaleString()}
            <span className="ml-0.5 text-[10px] font-normal text-neutral-400">
              人
            </span>
          </span>
        </div>
      </div>
      {ratio !== null && ratio !== 1 && (
        <div className="flex items-center bg-amber-600/15 px-2 text-[10px] tabular-nums text-amber-300">
          ×{ratio.toFixed(2)}
        </div>
      )}
    </div>
  );
}

type InflationPatch = Partial<
  Pick<
    Stream,
    "inflation_boost_start" | "inflation_real_max" | "inflation_target_max"
  >
>;

function InflationEditor({
  stream,
  onChange,
}: {
  stream: Stream;
  onChange: (patch: InflationPatch) => void;
}) {
  const boost = stream.inflation_boost_start;
  const realMax = stream.inflation_real_max;
  const targetMax = stream.inflation_target_max;

  const config = useMemo(
    () => ({
      boostStart: boost ?? VIEWER_COUNT_CONFIG.boostStart,
      realMax: realMax ?? VIEWER_COUNT_CONFIG.realMax,
      targetMax: targetMax ?? VIEWER_COUNT_CONFIG.targetMax,
    }),
    [boost, realMax, targetMax],
  );

  const previewRows = useMemo(() => {
    const points = [
      0,
      Math.floor(config.boostStart / 2),
      config.boostStart,
      Math.round(
        config.boostStart + (config.realMax - config.boostStart) * 0.5,
      ),
      config.realMax,
      Math.round(config.realMax * 1.5),
      Math.round(config.realMax * 2),
    ];
    return Array.from(new Set(points))
      .filter((n) => n >= 0)
      .sort((a, b) => a - b)
      .map((actual) => ({
        actual,
        displayed: inflateViewerCount(actual, config),
      }));
  }, [config]);

  const maxActual = previewRows[previewRows.length - 1]?.actual ?? 1;
  const maxDisplayed = previewRows[previewRows.length - 1]?.displayed ?? 1;

  // SVG カーブ用のポイント
  const curvePath = useMemo(() => {
    const W = 100;
    const H = 36;
    if (maxActual === 0) return "";
    const steps = 60;
    const parts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const actual = (i / steps) * maxActual;
      const displayed = inflateViewerCount(actual, config);
      const x = (i / steps) * W;
      const y = H - (displayed / Math.max(maxDisplayed, 1)) * H;
      parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return parts.join(" ");
  }, [config, maxActual, maxDisplayed]);

  const boostMarker = maxActual === 0 ? 0 : (config.boostStart / maxActual) * 100;
  const realMaxMarker =
    maxActual === 0 ? 0 : (config.realMax / maxActual) * 100;

  const handleBlur = (
    key: keyof InflationPatch,
    raw: string,
    fallback: number,
  ) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      if (stream[key] !== null) {
        onChange({ [key]: null } as InflationPatch);
      }
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return;
    const rounded = Math.floor(n);
    if (stream[key] === rounded) return;
    if (rounded === fallback && stream[key] === null) return;
    onChange({ [key]: rounded } as InflationPatch);
  };

  const customized =
    boost !== null || realMax !== null || targetMax !== null;

  return (
    <details className="rounded-md border border-bg-border bg-bg-input/40 px-3 py-2">
      <summary className="cursor-pointer text-[11px] text-neutral-300">
        視聴者数 表示係数
        {customized && (
          <span className="ml-2 rounded bg-amber-600/20 px-1.5 text-[10px] text-amber-300">
            カスタム
          </span>
        )}
      </summary>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <label className="flex flex-col gap-1">
          <span className="text-neutral-400">底開始</span>
          <input
            type="number"
            min={0}
            defaultValue={boost ?? ""}
            placeholder={String(VIEWER_COUNT_CONFIG.boostStart)}
            onBlur={(e) =>
              handleBlur(
                "inflation_boost_start",
                e.target.value,
                VIEWER_COUNT_CONFIG.boostStart,
              )
            }
            className="rounded bg-bg-input px-2 py-1 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-blue-500"
            key={`bs-${stream.id}-${boost ?? "default"}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-400">実数MAX</span>
          <input
            type="number"
            min={1}
            defaultValue={realMax ?? ""}
            placeholder={String(VIEWER_COUNT_CONFIG.realMax)}
            onBlur={(e) =>
              handleBlur(
                "inflation_real_max",
                e.target.value,
                VIEWER_COUNT_CONFIG.realMax,
              )
            }
            className="rounded bg-bg-input px-2 py-1 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-blue-500"
            key={`rm-${stream.id}-${realMax ?? "default"}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-neutral-400">表示MAX</span>
          <input
            type="number"
            min={1}
            defaultValue={targetMax ?? ""}
            placeholder={String(VIEWER_COUNT_CONFIG.targetMax)}
            onBlur={(e) =>
              handleBlur(
                "inflation_target_max",
                e.target.value,
                VIEWER_COUNT_CONFIG.targetMax,
              )
            }
            className="rounded bg-bg-input px-2 py-1 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-blue-500"
            key={`tm-${stream.id}-${targetMax ?? "default"}`}
          />
        </label>
      </div>
      {/* カーブのプレビュー */}
      <div className="mt-3 rounded-md bg-bg-base/60 p-2">
        <svg
          viewBox="0 0 100 36"
          preserveAspectRatio="none"
          className="block h-14 w-full"
        >
          {/* ゾーン背景 */}
          <rect
            x={0}
            y={0}
            width={boostMarker}
            height={36}
            fill="rgb(115 115 115 / 0.15)"
          />
          <rect
            x={boostMarker}
            y={0}
            width={Math.max(0, realMaxMarker - boostMarker)}
            height={36}
            fill="rgb(59 130 246 / 0.15)"
          />
          <rect
            x={realMaxMarker}
            y={0}
            width={Math.max(0, 100 - realMaxMarker)}
            height={36}
            fill="rgb(245 158 11 / 0.15)"
          />
          {/* 補助グリッド線(50% 線) */}
          <line
            x1={0}
            y1={18}
            x2={100}
            y2={18}
            stroke="rgb(255 255 255 / 0.05)"
            strokeWidth={0.3}
            vectorEffect="non-scaling-stroke"
          />
          {/* ゾーン境界の縦点線 */}
          <line
            x1={boostMarker}
            y1={0}
            x2={boostMarker}
            y2={36}
            stroke="rgb(163 163 163 / 0.5)"
            strokeWidth={0.5}
            strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={realMaxMarker}
            y1={0}
            x2={realMaxMarker}
            y2={36}
            stroke="rgb(163 163 163 / 0.5)"
            strokeWidth={0.5}
            strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke"
          />
          {/* y = x の参照線(無加工ライン) */}
          <line
            x1={0}
            y1={36}
            x2={100}
            y2={
              36 -
              (Math.min(maxActual, maxDisplayed) /
                Math.max(maxDisplayed, 1)) *
                36
            }
            stroke="rgb(115 115 115 / 0.5)"
            strokeWidth={0.5}
            strokeDasharray="1,2"
            vectorEffect="non-scaling-stroke"
          />
          {/* かさ増しカーブ */}
          <path
            d={curvePath}
            fill="none"
            stroke="rgb(96 165 250)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-500">
          <span>
            横軸: 実数 (0 →{" "}
            <span className="tabular-nums">
              {maxActual.toLocaleString()}
            </span>
            )
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-neutral-500/40" />
              実数表示
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-blue-500/40" />
              かさ増し
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/40" />
              ピーク継続
            </span>
          </span>
        </div>
      </div>

      {/* 詳細プレビュー表 */}
      <div className="mt-2 space-y-1">
        <div className="grid grid-cols-[3.5rem_3.5rem_3rem_1fr] gap-2 border-b border-bg-border/40 pb-1 text-[10px] text-neutral-500">
          <div>実数</div>
          <div>表示</div>
          <div>係数</div>
          <div></div>
        </div>
        {previewRows.map((r) => {
          const ratio = r.actual === 0 ? 1 : r.displayed / r.actual;
          const barPct =
            maxDisplayed === 0 ? 0 : (r.displayed / maxDisplayed) * 100;
          const zone =
            r.actual <= config.boostStart
              ? "low"
              : r.actual <= config.realMax
                ? "mid"
                : "high";
          const barClass =
            zone === "low"
              ? "bg-neutral-500/50"
              : zone === "mid"
                ? "bg-blue-500/60"
                : "bg-amber-500/60";
          return (
            <div
              key={r.actual}
              className="grid grid-cols-[3.5rem_3.5rem_3rem_1fr] items-center gap-2 text-[11px]"
            >
              <div className="tabular-nums text-neutral-400">
                {r.actual.toLocaleString()}
              </div>
              <div className="tabular-nums font-bold text-neutral-100">
                {r.displayed.toLocaleString()}
              </div>
              <div className="tabular-nums text-neutral-500">
                ×{ratio.toFixed(2)}
              </div>
              <div className="h-2 overflow-hidden rounded bg-bg-base/60">
                <div
                  className={`h-full rounded ${barClass}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] text-neutral-500">
        空欄保存でデフォルト({VIEWER_COUNT_CONFIG.boostStart}/
        {VIEWER_COUNT_CONFIG.realMax}/{VIEWER_COUNT_CONFIG.targetMax})に戻る。
        編集はリアルタイムで視聴者画面に反映。
      </p>
    </details>
  );
}
