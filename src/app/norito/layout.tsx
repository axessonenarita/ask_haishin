import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "祝詞",
  description: "祝詞を一緒に唱えて、回数を数えます。",
  manifest: "/api/norito/manifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "祝詞", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/norito/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/norito/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#10131e",
};

export default function NoritoLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-nr-bg text-nr-text">{children}</div>;
}
