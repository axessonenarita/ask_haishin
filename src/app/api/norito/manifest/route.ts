import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 会員用URLから入れたときは、ホーム画面のアプリも会員用URLで開くようにする
export async function GET(req: Request) {
  const k = new URL(req.url).searchParams.get("k");
  const safe = k && /^[a-z0-9]{8,64}$/.test(k) ? k : null;
  const start = safe ? `/norito/m/${safe}` : "/norito";
  const manifest = {
    name: "祝詞",
    short_name: "祝詞",
    description: "祝詞を一緒に唱えて、回数を数えます。",
    lang: "ja",
    start_url: start,
    id: start,
    scope: "/norito",
    display: "standalone",
    orientation: "portrait",
    background_color: "#10131e",
    theme_color: "#10131e",
    icons: [
      { src: "/norito/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/norito/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/norito/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new NextResponse(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" },
  });
}
