import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

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
  function addBanner(){
    if (!document.body) { setTimeout(addBanner, 50); return; }
    if (document.getElementById('__old-browser-warning')) return;
    var d = document.createElement('div');
    d.id = '__old-browser-warning';
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#7c2d12;color:#fff;padding:0.5rem 0.75rem;font-size:0.8rem;line-height:1.45;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;gap:0.5rem;align-items:flex-start;box-shadow:0 2px 8px rgba(0,0,0,0.4);';
    var msg = document.createElement('div');
    msg.style.cssText = 'flex:1;min-width:0;';
    msg.innerHTML = 'お使いのブラウザは古い可能性があります。一部の機能が正しく動作しないことがあります。Chrome / Safari / Edge / Firefox の最新版での閲覧をお勧めします。';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '閉じる';
    btn.style.cssText = 'flex-shrink:0;background:transparent;border:1px solid rgba(255,255,255,0.6);color:#fff;padding:0.15rem 0.6rem;border-radius:3px;font-size:0.75rem;cursor:pointer;';
    btn.onclick = function(){ d.parentNode && d.parentNode.removeChild(d); };
    d.appendChild(msg);
    d.appendChild(btn);
    document.body.insertBefore(d, document.body.firstChild);
  }
  addBanner();
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
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  );
}
