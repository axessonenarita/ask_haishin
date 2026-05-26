import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const replayEnabled = process.env.NEXT_PUBLIC_SENTRY_REPLAY === "1";

// 自分のコード(/_next/static や同一オリジン)以外のスタックフレームが
// 多数を占めるエラーは外部ライブラリ(GA/gtag/Vercel Analytics 等)由来と
// みなして送らない
function isLikelyExternalLibraryError(event: Sentry.ErrorEvent): boolean {
  const frames = event.exception?.values?.[0]?.stacktrace?.frames;
  if (!frames || frames.length === 0) return false;
  const ownOrigin =
    typeof window !== "undefined" ? window.location.origin : "";
  let externalCount = 0;
  let ownCount = 0;
  for (const f of frames) {
    const file = f.filename || "";
    if (
      file.includes("googletagmanager.com") ||
      file.includes("google-analytics.com") ||
      file.includes("vercel-analytics") ||
      file.includes("/_vercel/") ||
      file.includes("gtm.js") ||
      file.includes("gtag")
    ) {
      externalCount++;
    } else if (ownOrigin && file.startsWith(ownOrigin)) {
      ownCount++;
    }
  }
  // 自分のフレームが 1 つも無く外部が複数あるなら除外
  return ownCount === 0 && externalCount >= 1;
}

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: replayEnabled ? 1.0 : 0,
    integrations: replayEnabled
      ? [
          Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
          }),
        ]
      : [],
    beforeSend(event) {
      if (isLikelyExternalLibraryError(event)) {
        return null;
      }
      return event;
    },
  });
}
