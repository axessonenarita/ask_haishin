"use client";

import { useEffect, useState } from "react";

type AppType =
  | "line"
  | "instagram"
  | "facebook"
  | "twitter"
  | "tiktok"
  | "android-webview"
  | "ios-webview"
  | null;

const APP_LABEL: Record<Exclude<AppType, null>, string> = {
  line: "LINE",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X",
  tiktok: "TikTok",
  "android-webview": "アプリ内ブラウザ",
  "ios-webview": "アプリ内ブラウザ",
};

function detectInAppBrowser(): AppType {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/\bLine\//i.test(ua)) return "line";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/\bFB[AV]N?\//i.test(ua)) return "facebook";
  if (/Twitter/i.test(ua)) return "twitter";
  if (/(musical_ly|BytedanceWebview)/i.test(ua)) return "tiktok";
  if (/Android.*;\s*wv\)/i.test(ua)) return "android-webview";
  // iOS WKWebView: iPhone/iPad なのに Safari / Chrome / Firefox / Edge いずれの印もない
  if (
    /iPhone|iPad|iPod/i.test(ua) &&
    !/Safari\//i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS/i.test(ua)
  ) {
    return "ios-webview";
  }
  return null;
}

function tryOpenExternal(type: Exclude<AppType, null>): void {
  if (typeof window === "undefined") return;
  const url = window.location.href;
  const ua = navigator.userAgent;

  if (type === "line") {
    try {
      const u = new URL(url);
      u.searchParams.set("openExternalBrowser", "1");
      window.location.href = u.toString();
      return;
    } catch {
      // fall through
    }
  }

  if (/Android/i.test(ua)) {
    // packageを指定せず、ユーザーのデフォルトブラウザに任せる
    const stripped = url.replace(/^https?:\/\//, "");
    const intentUrl = `intent://${stripped}#Intent;scheme=https;end`;
    window.location.href = intentUrl;
    return;
  }

  if (/iPhone|iPad|iPod/i.test(ua)) {
    // iOS にはデフォルトブラウザを直接指定するAPIはない
    // 圧倒的シェアのSafariを優先（Chromeユーザーは「URLコピー」で対応）
    const safariUrl = url.replace(/^https?:\/\//, "x-safari-https://");
    window.location.href = safariUrl;
    return;
  }

  window.open(url, "_blank");
}

async function copyUrl(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    return false;
  }
}

export function InAppBrowserNotice() {
  const [type, setType] = useState<AppType>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setType(detectInAppBrowser());
  }, []);

  if (!type || dismissed) return null;

  const appName = APP_LABEL[type];

  const handleOpen = () => {
    tryOpenExternal(type);
  };

  const handleCopy = async () => {
    const ok = await copyUrl();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-start gap-2 bg-amber-700 px-3 py-2 text-xs text-white shadow-lg">
      <div className="min-w-0 flex-1 leading-snug">
        {appName}内のブラウザで開いています。動画再生などが不安定な場合は、Chrome や Safari で開いてください。
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={handleOpen}
          className="rounded border border-white/70 px-2 py-1 text-xs font-bold hover:bg-white/10"
        >
          ブラウザで開く
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-white/40 px-2 py-1 text-xs hover:bg-white/10"
        >
          {copied ? "コピー済" : "URLコピー"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded px-1.5 py-1 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
