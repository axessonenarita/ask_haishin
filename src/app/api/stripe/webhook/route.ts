import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }
  const raw = await req.text();

  let event: Stripe.Event;
  const stripe = getStripe();
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const meta = session.metadata ?? {};
  const stream_id = meta.stream_id;
  const nickname = meta.nickname;
  const avatar = meta.avatar;
  const color = meta.color;
  const body = meta.body ?? "";
  const fork_amount = Number(meta.fork_amount ?? "0");

  if (!stream_id || !nickname || !avatar || !color || !fork_amount) {
    return NextResponse.json({ error: "metadata missing" }, { status: 400 });
  }

  const supabase = getAdminClient();
  // stripe_session_id UNIQUE で二重挿入を防ぐ
  const { data, error } = await supabase
    .from("messages")
    .insert({
      nickname,
      avatar,
      color,
      body,
      role: "user",
      deleted: false,
      pinned: false,
      stream_id,
      fork_amount,
      stripe_session_id: session.id,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation (webhook 再送)
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ received: true, deduped: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Realtime broadcast(既存の fork-effects チャネル)
  const channel = supabase.channel(`fork-effects-${stream_id}`);
  await new Promise<void>((resolve) => {
    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await channel.send({
        type: "broadcast",
        event: "donation_completed",
        payload: {
          id: data.id,
          nickname,
          avatar,
          color,
          body,
          amount: fork_amount,
          at: Date.now(),
        },
      });
      await supabase.removeChannel(channel);
      resolve();
    });
    // タイムアウト(broadcast 失敗しても DB は保存済み、次回リアルタイム同期で反映)
    setTimeout(() => resolve(), 3000);
  });

  return NextResponse.json({ received: true, id: data.id });
}
