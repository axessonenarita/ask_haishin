import { LivePage } from "@/components/LivePage";
import { fetchActiveStream } from "@/lib/streamQuery";

export const dynamic = "force-dynamic";

export default async function Page() {
  const stream = await fetchActiveStream();
  return <LivePage stream={stream} />;
}
