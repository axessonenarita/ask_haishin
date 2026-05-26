import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASK ライブ配信",
  description: "ログイン不要のライブチャット",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f0f10",
};

const browserCheckScript = `
(function(){
  try {
    new Function("var a = null; return a?.b ?? 0")();
    return;
  } catch (e) {}
  var html = '' +
    '<head><meta charset="utf-8"><title>非対応ブラウザ</title>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
    '<body style="margin:0;background:#0f0f10;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">' +
    '<div style="max-width:520px;margin:4rem auto;padding:0 1.5rem;line-height:1.7;">' +
    '<h1 style="font-size:1.25rem;margin:0 0 1rem 0;">お使いのブラウザでは表示できません</h1>' +
    '<p style="margin:0 0 0.75rem 0;">このページを利用するには、最新版の Chrome / Safari / Edge / Firefox をご利用ください。</p>' +
    '<p style="margin:0;font-size:0.85rem;color:#888;">タブレットやスマートフォンの場合、設定アプリからシステムアップデートをご確認ください。</p>' +
    '</div></body>';
  document.documentElement.innerHTML = html;
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <script dangerouslySetInnerHTML={{ __html: browserCheckScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
