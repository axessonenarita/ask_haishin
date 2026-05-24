import { notFound } from "next/navigation";
import { fetchStreamBySlug } from "@/lib/streamQuery";
import { ReplayPage } from "@/components/ReplayPage";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export default async function Page({ params }: Props) {
  const stream = await fetchStreamBySlug(params.slug);
  if (!stream) notFound();
  return <ReplayPage stream={stream} />;
}
