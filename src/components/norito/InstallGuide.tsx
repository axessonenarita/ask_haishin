"use client";

import { useEffect, useState } from "react";
import { detectPlatform, isStandalone, type Platform } from "@/lib/norito/local";
import { currentSubscription, pushSupported, subscribePush, unsubscribePush } from "@/lib/norito/push-client";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-nr-gold text-xs text-nr-gold">
        {n}
      </span>
      <span className="min-w-0 text-sm leading-7">{children}</span>
    </li>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mx-0.5 inline h-4 w-4 align-[-2px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-label="共有">
      <path d="M10 2v11M6 6l4-4 4 4" />
      <path d="M5 9H4v9h12V9h-1" />
    </svg>
  );
}

export function InstallGuide({
  vapidKey,
  memberKey,
  onEvent,
}: {
  vapidKey: string | null;
  memberKey: string | null;
  onEvent?: (kind: string) => void;
}) {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [standalone, setStandalone] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bip, setBip] = useState<BIPEvent | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(isStandalone());
    setPerm(pushSupported() ? Notification.permission : "unsupported");
    currentSubscription().then((s) => setSubscribed(Boolean(s)));
    const h = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const turnOn = async () => {
    if (!vapidKey) {
      setMsg("通知の準備がまだできていません。しばらくしてからもう一度お試しください。");
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await subscribePush(vapidKey, memberKey);
    setBusy(false);
    if (r === "ok") {
      setSubscribed(true);
      setPerm("granted");
      setMsg("通知をオンにしました。奏上会の前と、便りが届いたときにお知らせします。");
      onEvent?.("push_on");
    } else if (r === "denied") {
      setPerm(Notification.permission);
      setMsg("通知が許可されませんでした。下の「通知が届かないとき」を見てください。");
    } else if (r === "unsupported") {
      setMsg("この開き方では通知を受け取れません。先にホーム画面に置いてください。");
    } else {
      setMsg("うまくいきませんでした。電波のよいところで、もう一度押してください。");
    }
  };

  const turnOff = async () => {
    setBusy(true);
    await unsubscribePush();
    setBusy(false);
    setSubscribed(false);
    setMsg("通知を止めました。");
  };

  const ios = platform === "ios-safari" || platform === "ios-other";
  const needsInstallFirst = ios && !standalone;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-mincho text-lg text-nr-gold">1. ホーム画面に置く</h2>
        {standalone ? (
          <p className="text-sm leading-7">ホーム画面から開いています。このままアプリとして使えます。</p>
        ) : platform === "in-app" ? (
          <ol className="flex flex-col gap-2">
            <Step n={1}>
              いまは LINE などのアプリの中で開いています。右上や右下の「…」から<b>「ブラウザで開く」</b>（iPhone は Safari）を選んでください。
            </Step>
            <Step n={2}>開き直したら、もう一度この「使い方」を見てください。</Step>
          </ol>
        ) : ios ? (
          <ol className="flex flex-col gap-2">
            {platform === "ios-other" && (
              <Step n={0 + 1}>
                iPhone では <b>Safari</b> で開くのがいちばん確実です。このページを Safari で開いてから進めてください。
              </Step>
            )}
            <Step n={platform === "ios-other" ? 2 : 1}>
              画面の下（iPad は右上）の<b>共有ボタン</b>
              <ShareIcon />
              を押します。
            </Step>
            <Step n={platform === "ios-other" ? 3 : 2}>
              下へ動かして<b>「ホーム画面に追加」</b>を押します。見当たらないときは「その他」や「…」の中にあります。
            </Step>
            <Step n={platform === "ios-other" ? 4 : 3}>
              右上の<b>「追加」</b>を押すと、ホーム画面に「祝詞」が並びます。
            </Step>
            <Step n={platform === "ios-other" ? 5 : 4}>
              ここで一度閉じて、<b>ホーム画面の「祝詞」から開き直します</b>。通知はそこからでないとオンにできません。
            </Step>
          </ol>
        ) : platform === "android" ? (
          <ol className="flex flex-col gap-2">
            {bip ? (
              <Step n={1}>
                <button
                  type="button"
                  onClick={async () => {
                    await bip.prompt();
                    setBip(null);
                  }}
                  className="rounded-full bg-nr-gold px-5 py-2 text-sm font-bold text-nr-bg"
                >
                  ホーム画面に追加する
                </button>
              </Step>
            ) : (
              <Step n={1}>
                Chrome の右上の<b>「⋮」</b>を押して、<b>「ホーム画面に追加」</b>か<b>「アプリをインストール」</b>を選びます。
              </Step>
            )}
            <Step n={2}>ホーム画面に「祝詞」が並んだら、そこから開きます。</Step>
          </ol>
        ) : (
          <p className="text-sm leading-7">
            パソコンでもこのまま使えます。スマホで使うときは、スマホでこのページを開いて、この「使い方」の手順で置いてください。
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mincho text-lg text-nr-gold">2. 通知をオンにする</h2>
        <p className="text-sm leading-7 text-nr-muted">
          土曜・日曜の奏上会が始まる少し前と、週に一度の便りが届いたときにお知らせします。それ以外には送りません。
        </p>
        {needsInstallFirst ? (
          <p className="rounded-xl border border-nr-line bg-nr-panel px-4 py-3 text-sm leading-7">
            iPhone は、ホーム画面に置いた「祝詞」から開いたときだけ通知をオンにできます。先に 1 を済ませてください。
          </p>
        ) : perm === "unsupported" ? (
          <p className="rounded-xl border border-nr-line bg-nr-panel px-4 py-3 text-sm leading-7">
            この端末やブラウザでは通知を受け取れません。iPhone は iOS 16.4 以降が必要です。
          </p>
        ) : subscribed && perm === "granted" ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-nr-goldSoft px-4 py-2 text-sm text-nr-gold">通知はオンです</span>
            <button type="button" disabled={busy} onClick={turnOff} className="text-xs text-nr-muted underline">
              通知を止める
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={turnOn}
            className="self-start rounded-full bg-nr-gold px-6 py-3 text-sm font-bold text-nr-bg disabled:opacity-60"
          >
            {busy ? "準備しています…" : "通知を受け取る"}
          </button>
        )}
        {!needsInstallFirst && perm !== "unsupported" && !(subscribed && perm === "granted") && (
          <p className="text-xs leading-6 text-nr-muted">押したあとに出る確認で「許可」を選んでください。</p>
        )}
        {msg && <p className="text-sm leading-7 text-nr-gold">{msg}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mincho text-base text-nr-gold">通知が届かないとき</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-7 text-nr-muted">
          <li>
            iPhone：「設定」→「通知」→「祝詞」で「通知を許可」をオンにします。集中モードやおやすみモードの間は届きません。
          </li>
          <li>Android：ホーム画面の「祝詞」を長押し →「アプリ情報」→「通知」をオンにします。</li>
          <li>一度「許可しない」を選んだときも、上の場所からオンにできます。</li>
          <li>ホーム画面から消すと通知も止まります。置き直したら、もう一度「通知を受け取る」を押してください。</li>
        </ul>
      </section>
    </div>
  );
}
