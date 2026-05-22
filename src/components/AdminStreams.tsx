"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Stream, StreamStatus } from "@/lib/types";

const STATUSES: StreamStatus[] = ["waiting", "live", "ended"];

const STATUS_LABEL: Record<StreamStatus, string> = {
  waiting: "開始前 (waiting)",
  live: "配信中 (live)",
  ended: "終了 (ended)",
};

const STATUS_BADGE: Record<StreamStatus, string> = {
  waiting: "bg-neutral-600 text-neutral-100",
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
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  return isoToLocalInput(d.toISOString());
}

type FormState = {
  title: string;
  description: string;
  startLocal: string;
  hls_url: string;
  status: StreamStatus;
};

export function AdminStreams() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(() => ({
    title: "",
    description: "",
    startLocal: defaultStartLocal(),
    hls_url: "",
    status: "waiting",
  }));

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
      setForm({
        title: "",
        description: "",
        startLocal: defaultStartLocal(),
        hls_url: "",
        status: "waiting",
      });
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
    <section className="mb-8 rounded-lg bg-bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">配信管理</h2>
        <button
          type="button"
          onClick={load}
          className="rounded-md bg-bg-input px-3 py-1 text-sm hover:bg-neutral-700"
        >
          再読込
        </button>
      </div>

      <form
        onSubmit={handleCreate}
        className="mb-6 grid gap-3 rounded-md border border-bg-border p-3 md:grid-cols-2"
      >
        <div className="md:col-span-2 text-sm font-bold text-neutral-200">
          新規配信を追加
        </div>

        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-neutral-300">タイトル</span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="例：5月22日 配信"
            className="w-full rounded-md bg-bg-input px-3 py-2 outline-none"
          />
        </label>

        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-neutral-300">概要（任意）</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="本日の配信内容、テーマ、注意事項など"
            className="w-full rounded-md bg-bg-input px-3 py-2 outline-none"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-300">開始日時（端末ローカル）</span>
          <input
            type="datetime-local"
            value={form.startLocal}
            onChange={(e) => setForm({ ...form, startLocal: e.target.value })}
            className="w-full rounded-md bg-bg-input px-3 py-2 outline-none"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-300">初期ステータス</span>
          <select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as StreamStatus })
            }
            className="w-full rounded-md bg-bg-input px-3 py-2 outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-neutral-300">HLS URL (m3u8)</span>
          <input
            type="url"
            value={form.hls_url}
            onChange={(e) => setForm({ ...form, hls_url: e.target.value })}
            placeholder="https://vz-xxxxxxxx-xxx.b-cdn.net/<video-guid>/playlist.m3u8"
            className="w-full rounded-md bg-bg-input px-3 py-2 outline-none"
          />
        </label>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 font-bold hover:bg-blue-500 disabled:opacity-50"
          >
            登録
          </button>
          {error && (
            <span className="ml-3 text-sm text-red-400">{error}</span>
          )}
        </div>
      </form>

      <div className="text-sm">
        {loading ? (
          <div className="text-neutral-400">読み込み中…</div>
        ) : streams.length === 0 ? (
          <div className="text-neutral-400">配信が登録されていません</div>
        ) : (
          <ul className="divide-y divide-bg-border">
            {streams.map((s) => {
              const isActive = activeStream?.id === s.id;
              return (
                <li
                  key={s.id}
                  className={`flex flex-col gap-2 py-3 md:flex-row md:items-start md:gap-3 ${
                    s.status === "ended" ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[s.status]}`}
                      >
                        {s.status}
                      </span>
                      {isActive && (
                        <span className="rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                          視聴ページ表示中
                        </span>
                      )}
                      <span className="font-bold">{s.title}</span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-400">
                      開始：{new Date(s.start_at).toLocaleString("ja-JP")}
                    </div>
                    <StreamUrl slug={s.slug} />
                    <div className="mt-1 break-all text-[11px] text-neutral-500">
                      {s.hls_url}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={s.status}
                      onChange={(e) =>
                        updateField(s.id, {
                          status: e.target.value as StreamStatus,
                        })
                      }
                      className="rounded-md bg-bg-input px-2 py-1 text-xs"
                    >
                      {STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {STATUS_LABEL[st]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const next = window.prompt(
                          "概要を編集",
                          s.description ?? "",
                        );
                        if (next === null) return;
                        void updateField(s.id, { description: next });
                      }}
                      className="rounded-md bg-bg-input px-2 py-1 text-xs hover:bg-neutral-700"
                    >
                      概要編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="rounded-md bg-red-600/20 px-2 py-1 text-xs text-red-300 hover:bg-red-600/40"
                    >
                      削除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-3 text-[11px] text-neutral-500">
        視聴ページには「終了していない配信のうち開始日時が最も近いもの」を1件表示します。すべて終了済みの場合は最新の1件が「配信は終了しました」として表示されます。
      </p>
    </section>
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
    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-300">
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
        {copied ? "コピー済" : "URLコピー"}
      </button>
    </div>
  );
}
