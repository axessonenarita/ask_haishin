const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // 祝詞アプリの service worker を /norito 全体（会員用URLも含む）に効かせる
        source: "/norito/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/norito" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};
const sentryWebpackPluginOptions = {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
  widenClientFileUpload: true,
};

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
