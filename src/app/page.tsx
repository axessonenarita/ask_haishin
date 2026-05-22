import { LivePage } from "@/components/LivePage";

export default function Page() {
  const embedUrl = process.env.NEXT_PUBLIC_VIMEO_EMBED_URL;
  return <LivePage embedUrl={embedUrl} />;
}
