import { notFound } from "next/navigation";
import { LivePage } from "@/components/LivePage";
import { fetchStreamBySlug } from "@/lib/streamQuery";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export default async function StreamPage({ params }: Props) {
  const stream = await fetchStreamBySlug(params.slug);
  if (!stream) notFound();
  return <LivePage stream={stream} />;
}
