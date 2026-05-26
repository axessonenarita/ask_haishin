import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const replayEnabled = process.env.NEXT_PUBLIC_SENTRY_REPLAY === "1";

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
  });
}
