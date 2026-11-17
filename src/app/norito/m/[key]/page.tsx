import type { Metadata } from "next";
import Link from "next/link";
import { NoritoApp } from "@/components/norito/NoritoApp";
import { keyMatches, loadSettings } from "@/lib/norito/settings";

export const dynamic = "force-dynamic";

type Props = { params: { key: string } };

export function generateMetadata({ params }: Props): Metadata {
  const safe = /^[a-z0-9]{8,64}$/.test(params.key) ? params.key : "";
  return { manifest: safe ? `/api/norito/manifest?k=${safe}` : "/api/norito/manifest" };
}

export default async function MemberPage({ params }: Props) {
  const { settings } = await loadSettings();
  if (!keyMatches(params.key, settings.member_key)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="font-mincho text-xl text-nr-gold">このURLは使えなくなりました</h1>
        <p className="text-sm leading-7 text-nr-muted">
          会員用のURLが新しくなっています。サロンの中のお知らせから、新しいURLを開いてください。
        </p>
        <Link href="/norito" className="mx-auto rounded-full border border-nr-gold px-5 py-2 text-sm text-nr-gold">
          ふつうの画面で開く
        </Link>
      </main>
    );
  }
  return <NoritoApp memberKey={params.key} />;
}
