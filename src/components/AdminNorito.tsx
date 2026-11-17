"use client";

import { useCallback, useEffect, useState } from "react";

type Sub = "letters" | "events" | "prayers" | "videos" | "salon_posts" | "settings" | "stats";
const SUBS: { id: Sub; label: string }[] = [
  { id: "letters", label: "便り" },
  { id: "events", label: "予定" },
  { id: "prayers", label: "祝詞" },
  { id: "videos", label: "動画の目録" },
  { id: "salon_posts", label: "サロン新着" },
  { id: "settings", label: "設定・会員用URL" },
  { id: "stats", label: "数" },
];

const input = "w-full rounded-md border border-bg-border bg-bg-input px-3 py-2 text-sm text-white";
const btn = "rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const btnGhost = "rounded-md border border-bg-border px-3 py-1.5 text-xs text-neutral-300";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const j = new Date(d.getTime() + 9 * 3600_000);
  return j.toISOString().slice(0, 16);
}
function fromLocalInput(v: string): string {
  return new Date(`${v}:00+09:00`).toISOString();
}

export function AdminNorito() {
  const [sub, setSub] = useState<Sub>("letters");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSub(s.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${sub === s.id ? "bg-blue-600 font-bold text-white" : "text-neutral-300 hover:bg-bg-input"}`}
          >
            {s.label}
          </button>
        ))}
        <a href="/norito" target="_blank" rel="noopener" className="ml-auto text-xs text-blue-400 underline">
          アプリを開く
        </a>
      </div>
      {sub === "letters" && <Letters />}
      {sub === "events" && <Events />}
      {sub === "prayers" && (
        <JsonTable
          table="prayers"
          help={
            "1件ずつ { slug, title, body, audio_url, note, members_only, sort, published }。slug が同じなら上書きします。body は1行1句。行頭に「12.5|」と書くと、その秒で行が光ります（書かなければ文字数で按分）。members_only: true は会員用URLだけで見えます。"
          }
          template={[
            {
              slug: "harae",
              title: "祓詞",
              body: "掛けまくも畏き\n伊邪那岐大神",
              audio_url: "https://…/harae.mp3",
              note: "",
              members_only: false,
              sort: 10,
              published: true,
            },
          ]}
        />
      )}
      {sub === "videos" && (
        <JsonTable
          table="videos"
          help={
            "1件ずつ { chapter, title, aired_on(YYYY-MM-DD), kind(soujoukai/reading/iyasaka/other), people[], summary, youtube_url, salon_url, members_only, sort }。chapter は弥栄の記の章・回の名前で、同じ chapter がひとまとまりになります。id 付きは上書き、id なしは追加です。"
          }
          template={[
            {
              chapter: "第二話 声が戻った夜",
              title: "（動画の題名）",
              aired_on: "2025-10-23",
              kind: "soujoukai",
              people: ["アスク"],
              summary: "",
              youtube_url: "",
              salon_url: "",
              members_only: false,
              sort: 100,
            },
          ]}
        />
      )}
      {sub === "salon_posts" && (
        <JsonTable
          table="salon_posts"
          help={"1件ずつ { id(DMMの投稿ID), title, author, posted_at, url }。本文は入れないでください。会員でない人には題名だけ見え、押すとサロンのトップへ移ります。"}
          template={[{ id: "123456", title: "（投稿の題名）", author: "ヒロ", posted_at: new Date().toISOString(), url: "" }]}
        />
      )}
      {sub === "settings" && <Settings />}
      {sub === "stats" && <Stats />}
    </div>
  );
}

type LetterRow = { id: string; title: string; body: string; published_at: string; notified_at: string | null };

function Letters() {
  const [rows, setRows] = useState<LetterRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(() => api<{ rows: LetterRow[] }>("/api/admin/norito/letters").then((d) => setRows(d.rows)), []);
  useEffect(() => {
    reload().catch((e) => setMsg(e.message));
  }, [reload]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api<{ rows: LetterRow[] }>("/api/admin/norito/letters", {
        method: "POST",
        body: JSON.stringify({ title, body, published_at: new Date().toISOString() }),
      });
      let m = "便りを載せました。";
      if (notify && d.rows[0]) {
        const r = await api<{ sent: number; failed: number }>("/api/admin/norito/notify", {
          method: "POST",
          body: JSON.stringify({ letter_id: d.rows[0].id }),
        });
        m += ` 通知を ${r.sent} 件送りました${r.failed ? `（届かなかった ${r.failed} 件）` : ""}。`;
      }
      setMsg(m);
      setTitle("");
      setBody("");
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-lg border border-bg-border bg-bg-panel p-4">
        <h2 className="font-bold">新しい便り</h2>
        <input id="letter-title" className={input} placeholder="題名（通知にも出ます）" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea id="letter-body" className={`${input} h-64`} placeholder="本文" value={body} onChange={(e) => setBody(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          載せたら通知を送る
        </label>
        <button type="button" className={btn} disabled={busy || !title.trim()} onClick={save}>
          {busy ? "送っています…" : "載せる"}
        </button>
        {msg && <p className="text-sm text-neutral-300">{msg}</p>}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">これまでの便り</h2>
        {rows.map((r) => (
          <div key={r.id} className="flex items-start gap-2 rounded-md border border-bg-border bg-bg-panel p-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-neutral-400">
                {new Date(r.published_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                {r.notified_at ? "・通知済み" : ""}
              </div>
              <div className="font-bold">{r.title}</div>
            </div>
            <button
              type="button"
              className={btnGhost}
              onClick={async () => {
                if (!window.confirm("この便りを消しますか？")) return;
                await api(`/api/admin/norito/letters?id=${r.id}`, { method: "DELETE" });
                reload();
              }}
            >
              消す
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

type EventRow = { id: string; title: string; start_at: string; place: string; url: string | null; note: string | null; notify: boolean; notified_at: string | null };

function Events() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [form, setForm] = useState({ title: "", start: "", place: "youtube", url: "", note: "", notify: true });
  const [msg, setMsg] = useState<string | null>(null);
  const reload = useCallback(() => api<{ rows: EventRow[] }>("/api/admin/norito/events").then((d) => setRows(d.rows)), []);
  useEffect(() => {
    reload().catch((e) => setMsg(e.message));
  }, [reload]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-lg border border-bg-border bg-bg-panel p-4">
        <h2 className="font-bold">特別な予定を足す</h2>
        <p className="text-xs leading-5 text-neutral-400">
          毎週土日21:00の奏上会は自動で並ぶので入れなくて大丈夫です。緊急の回や時間が違う回だけ入れてください。同じ日に予定を入れると、その日の自動の回は出ません。
        </p>
        <input id="event-title" className={input} placeholder="題名（例：緊急祝詞奏上会）" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input id="event-start" type="datetime-local" className={input} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
        <select id="event-place" className={input} value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })}>
          <option value="youtube">YouTube</option>
          <option value="salon">サロン</option>
          <option value="other">そのほか</option>
        </select>
        <input id="event-url" className={input} placeholder="開くURL（YouTube の配信など。サロンなら空でよい）" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <input id="event-note" className={input} placeholder="ひとこと（任意）" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} />
          始まる前に通知する
        </label>
        <button
          type="button"
          className={btn}
          disabled={!form.title || !form.start}
          onClick={async () => {
            try {
              await api("/api/admin/norito/events", {
                method: "POST",
                body: JSON.stringify({
                  title: form.title,
                  start_at: fromLocalInput(form.start),
                  place: form.place,
                  url: form.url || null,
                  note: form.note || null,
                  notify: form.notify,
                }),
              });
              setForm({ title: "", start: "", place: "youtube", url: "", note: "", notify: true });
              setMsg("足しました。");
              reload();
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          足す
        </button>
        {msg && <p className="text-sm text-neutral-300">{msg}</p>}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">登録した予定</h2>
        {rows.map((r) => (
          <div key={r.id} className="flex items-start gap-2 rounded-md border border-bg-border bg-bg-panel p-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-neutral-400">
                {toLocalInput(r.start_at).replace("T", " ")}・{r.place}
                {r.notified_at ? "・通知済み" : ""}
              </div>
              <div className="font-bold">{r.title}</div>
            </div>
            <button
              type="button"
              className={btnGhost}
              onClick={async () => {
                if (!window.confirm("この予定を消しますか？")) return;
                await api(`/api/admin/norito/events?id=${r.id}`, { method: "DELETE" });
                reload();
              }}
            >
              消す
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function JsonTable({ table, help, template }: { table: string; help: string; template: unknown[] }) {
  const [text, setText] = useState("");
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const d = await api<{ rows: Record<string, unknown>[] }>(`/api/admin/norito/${table}`);
    setCount(d.rows.length);
    const clean = d.rows.map(({ created_at: _c, notified_at: _n, ...rest }) => rest);
    setText(JSON.stringify(clean.length ? clean : template, null, 2));
  }, [table, template]);

  useEffect(() => {
    reload().catch((e) => setMsg(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs leading-5 text-neutral-400">{help}</p>
      <p className="text-xs text-neutral-400">いま {count} 件。下の JSON を直して「保存」を押すと、まとめて反映します（ここから消した行は消えません。消すときは id を指定して下の欄から）。</p>
      <textarea id={`json-${table}`} className={`${input} h-[60vh] font-mono text-xs`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btn}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              const parsed = JSON.parse(text);
              const d = await api<{ rows: unknown[] }>(`/api/admin/norito/${table}`, { method: "POST", body: JSON.stringify(parsed) });
              setMsg(`${d.rows.length} 件を保存しました。`);
              await reload();
            } catch (e) {
              setMsg((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          保存
        </button>
        <DeleteById table={table} onDone={reload} />
        {msg && <span className="text-sm text-neutral-300">{msg}</span>}
      </div>
    </section>
  );
}

function DeleteById({ table, onDone }: { table: string; onDone: () => void }) {
  const [id, setId] = useState("");
  return (
    <span className="flex items-center gap-2">
      <input id={`del-${table}`} className="w-72 rounded-md border border-bg-border bg-bg-input px-2 py-1 text-xs" placeholder="消す行の id" value={id} onChange={(e) => setId(e.target.value)} />
      <button
        type="button"
        className={btnGhost}
        disabled={!id}
        onClick={async () => {
          if (!window.confirm(`${id} を消しますか？`)) return;
          await api(`/api/admin/norito/${table}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
          setId("");
          onDone();
        }}
      >
        消す
      </button>
    </span>
  );
}

type SettingsResp = {
  settings: { member_key: string | null; salon_url: string; youtube_url: string | null; skip_dates: string[]; sunday_notify_all: boolean };
  vapidConfigured: boolean;
  cronConfigured: boolean;
};

function Settings() {
  const [s, setS] = useState<SettingsResp | null>(null);
  const [form, setForm] = useState({ salon_url: "", youtube_url: "", skip_dates: "", sunday_notify_all: false });
  const [msg, setMsg] = useState<string | null>(null);
  const [test, setTest] = useState({ title: "テスト通知", body: "通知が届くかの確認です" });

  const reload = useCallback(async () => {
    const d = await api<SettingsResp>("/api/admin/norito/settings");
    setS(d);
    setForm({
      salon_url: d.settings.salon_url,
      youtube_url: d.settings.youtube_url ?? "",
      skip_dates: d.settings.skip_dates.join(", "),
      sunday_notify_all: d.settings.sunday_notify_all,
    });
  }, []);
  useEffect(() => {
    reload().catch((e) => setMsg(e.message));
  }, [reload]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const memberUrl = s?.settings.member_key ? `${origin}/norito/m/${s.settings.member_key}` : null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-lg border border-bg-border bg-bg-panel p-4">
        <h2 className="font-bold">会員用URL</h2>
        <p className="text-xs leading-5 text-neutral-400">
          このURLから開くと、会員限定の祝詞と動画も見られます。サロンの中だけでお知らせしてください。作り直すと前のURLは使えなくなり、前のURLでホーム画面に置いた人は置き直しが必要です。
        </p>
        <div className="break-all rounded-md bg-bg-input px-3 py-2 font-mono text-xs">{memberUrl ?? "まだ作っていません"}</div>
        <div className="flex gap-2">
          {memberUrl && (
            <button type="button" className={btnGhost} onClick={() => navigator.clipboard.writeText(memberUrl).then(() => setMsg("コピーしました"))}>
              コピー
            </button>
          )}
          <button
            type="button"
            className={btnGhost}
            onClick={async () => {
              if (memberUrl && !window.confirm("作り直すと、いまのURLは使えなくなります。よろしいですか？")) return;
              await api("/api/admin/norito/settings", { method: "POST", body: JSON.stringify({ action: "new_member_key" }) });
              reload();
            }}
          >
            {memberUrl ? "作り直す" : "作る"}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-bg-border bg-bg-panel p-4">
        <h2 className="font-bold">リンクと予定</h2>
        <label className="text-xs text-neutral-400">サロンのURL（アプリの「サロンを開く」の行き先）</label>
        <input id="set-salon" className={input} value={form.salon_url} onChange={(e) => setForm({ ...form, salon_url: e.target.value })} />
        <label className="text-xs text-neutral-400">土曜の奏上会で開く YouTube のURL（チャンネルのライブ一覧など）</label>
        <input id="set-youtube" className={input} value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} />
        <label className="text-xs text-neutral-400">奏上会がない日（YYYY-MM-DD をカンマ区切り）</label>
        <input id="set-skip" className={input} value={form.skip_dates} onChange={(e) => setForm({ ...form, skip_dates: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.sunday_notify_all} onChange={(e) => setForm({ ...form, sunday_notify_all: e.target.checked })} />
          日曜（サロン）の奏上会の通知を、会員以外にも送る
        </label>
        <button
          type="button"
          className={btn}
          onClick={async () => {
            try {
              await api("/api/admin/norito/settings", { method: "POST", body: JSON.stringify(form) });
              setMsg("保存しました。");
              reload();
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          保存
        </button>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-bg-border bg-bg-panel p-4">
        <h2 className="font-bold">通知</h2>
        <p className="text-sm">
          通知の鍵：{s?.vapidConfigured ? "設定済み" : "未設定（README の手順で VAPID を入れてください）"}
          <br />
          奏上会前の自動通知：{s?.cronConfigured ? "CRON_SECRET 設定済み" : "未設定"}
        </p>
        <input id="test-title" className={input} value={test.title} onChange={(e) => setTest({ ...test, title: e.target.value })} />
        <input id="test-body" className={input} value={test.body} onChange={(e) => setTest({ ...test, body: e.target.value })} />
        <button
          type="button"
          className={btnGhost}
          onClick={async () => {
            if (!window.confirm("通知をオンにしている全員に送ります。よろしいですか？")) return;
            try {
              const r = await api<{ sent: number; failed: number }>("/api/admin/norito/notify", { method: "POST", body: JSON.stringify(test) });
              setMsg(`${r.sent} 件送りました${r.failed ? `（届かなかった ${r.failed} 件）` : ""}`);
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          全員に通知を送る
        </button>
      </section>
      {msg && <p className="text-sm text-neutral-300 md:col-span-2">{msg}</p>}
    </div>
  );
}

type StatsResp = {
  summary: Record<string, { devices: number; devices7d: number; hits7d: number; members: number }>;
  subscriptions: number;
  memberSubscriptions: number;
  daily: Record<string, Record<string, number>>;
};

const STAT_LABEL: Record<string, string> = {
  open: "開いた端末",
  standalone: "ホーム画面から開いた端末",
  push_on: "通知をオンにした端末",
  salon_click: "サロンへ移った（押した端末）",
};

function Stats() {
  const [d, setD] = useState<StatsResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<StatsResp>("/api/admin/norito/stats").then(setD).catch((e) => setErr(e.message));
  }, []);
  if (err) return <p className="text-sm text-red-400">{err}</p>;
  if (!d) return <p className="text-sm text-neutral-400">読み込み中…</p>;
  const days = Object.keys(d.daily).sort().reverse().slice(0, 30);
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-neutral-400">直近90日。同じ端末の同じ動きは1日1回だけ数えます（サロンへ移った数は押した回数そのまま）。名前などは取っていません。</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(STAT_LABEL).map(([k, label]) => {
          const v = d.summary[k];
          return (
            <div key={k} className="rounded-lg border border-bg-border bg-bg-panel p-4">
              <div className="text-xs text-neutral-400">{label}</div>
              <div className="text-2xl font-bold tabular-nums">{v?.devices ?? 0}</div>
              <div className="text-xs text-neutral-400">
                直近7日 {v?.devices7d ?? 0}（うち会員 {v?.members ?? 0}）
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-sm">
        いま通知が届く端末：{d.subscriptions}（うち会員用URL {d.memberSubscriptions}）
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-xs text-neutral-400">
            <tr>
              <th className="py-1 pr-4">日</th>
              <th className="pr-4">開いた</th>
              <th className="pr-4">ホーム画面</th>
              <th className="pr-4">通知オン</th>
              <th className="pr-4">サロンへ</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day} className="border-t border-bg-border">
                <td className="py-1 pr-4">{day}</td>
                <td className="pr-4">{d.daily[day].open ?? 0}</td>
                <td className="pr-4">{d.daily[day].standalone ?? 0}</td>
                <td className="pr-4">{d.daily[day].push_on ?? 0}</td>
                <td className="pr-4">{d.daily[day].salon_click ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
