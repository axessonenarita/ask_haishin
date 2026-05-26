"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";

type Result = { kind: "ok" | "err"; text: string } | null;

export function SentryTestPanel() {
  const [result, setResult] = useState<Result>(null);
  const [pending, setPending] = useState<string | null>(null);

  const dsnSet = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

  const sendCaptureException = async () => {
    setPending("captureException");
    setResult(null);
    try {
      const eventId = Sentry.captureException(
        new Error(`manual test: captureException @ ${new Date().toISOString()}`),
      );
      await Sentry.flush(3000);
      setResult({ kind: "ok", text: `送信 (eventId: ${eventId || "n/a"})` });
    } catch (e) {
      setResult({ kind: "err", text: `失敗: ${(e as Error).message}` });
    } finally {
      setPending(null);
    }
  };

  const sendCaptureMessage = async () => {
    setPending("captureMessage");
    setResult(null);
    try {
      const eventId = Sentry.captureMessage(
        `manual test: captureMessage @ ${new Date().toISOString()}`,
        { level: "info" },
      );
      await Sentry.flush(3000);
      setResult({ kind: "ok", text: `送信 (eventId: ${eventId || "n/a"})` });
    } catch (e) {
      setResult({ kind: "err", text: `失敗: ${(e as Error).message}` });
    } finally {
      setPending(null);
    }
  };

  const throwUncaught = () => {
    setPending("throw");
    setTimeout(() => {
      throw new Error(
        `manual test: uncaught error @ ${new Date().toISOString()}`,
      );
    }, 0);
  };

  const triggerServerError = async () => {
    setPending("server");
    setResult(null);
    try {
      const res = await fetch("/api/admin/sentry-test", { method: "POST" });
      setResult({
        kind: res.ok ? "err" : "ok",
        text: `server status: ${res.status}`,
      });
    } catch (e) {
      setResult({ kind: "err", text: `失敗: ${(e as Error).message}` });
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="mb-8 rounded-lg bg-bg-panel p-4">
      <h2 className="mb-2 font-bold">Sentry 動作確認</h2>
      <p className="mb-3 text-xs text-neutral-400">
        ボタンを押すと Sentry にテストイベントを送ります。Sentry のダッシュボードに
        manual test の event が来ているか確認してください。
        {!dsnSet && (
          <span className="ml-1 text-red-400">
            ⚠ NEXT_PUBLIC_SENTRY_DSN が未設定の可能性があります(クライアント側で
            検出できず)。
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={sendCaptureException}
          disabled={pending !== null}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
        >
          captureException
        </button>
        <button
          type="button"
          onClick={sendCaptureMessage}
          disabled={pending !== null}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
        >
          captureMessage
        </button>
        <button
          type="button"
          onClick={throwUncaught}
          disabled={pending !== null}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-bold hover:bg-amber-500 disabled:opacity-50"
        >
          未捕捉エラーを投げる
        </button>
        <button
          type="button"
          onClick={triggerServerError}
          disabled={pending !== null}
          className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-bold hover:bg-purple-500 disabled:opacity-50"
        >
          サーバー側エラー(API)
        </button>
      </div>
      {result && (
        <div
          className={`mt-3 text-xs ${
            result.kind === "ok" ? "text-green-400" : "text-red-400"
          }`}
        >
          {result.text}
        </div>
      )}
    </section>
  );
}
