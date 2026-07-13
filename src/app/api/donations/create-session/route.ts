import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isValidDonationAmount, tierForAmount } from "@/lib/donation";
import {
  isAvatarId,
  isColorId,
  containsBannedWord,
  sanitizeBody,
  sanitizeNickname,
} from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const p = payload as Record<string, unknown>;
  const amount = typeof p.amount === "number" ? p.amount : Number(p.amount);
  const nickname = sanitizeNickname(String(p.nickname ?? ""));
  const rawBody = String(p.body ?? "");
  const avatar = p.avatar;
  const color = p.color;
  const stream_id = typeof p.stream_id === "string" ? p.stream_id : "";

  if (!isValidDonationAmount(amount)) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }
  if (!nickname) {
    return NextResponse.json({ error: "nickname required" }, { status: 400 });
  }
  if (!isAvatarId(avatar)) {
    return NextResponse.json({ error: "invalid avatar" }, { status: 400 });
  }
  if (!isColorId(color)) {
    return NextResponse.json({ error: "invalid color" }, { status: 400 });
  }
  if (!stream_id) {
    return NextResponse.json({ error: "stream_id required" }, { status: 400 });
  }

  const tier = tierForAmount(amount);
  const body = sanitizeBody(rawBody).slice(0, tier.maxBodyLength);
  if (containsBannedWord(body)) {
    return NextResponse.json({ error: "禁止語が含まれています" }, { status: 400 });
  }

  // 存在チェック(削除済み配信への奉納を弾く)
  const supabase = getAdminClient();
  const { data: stream, error: streamErr } = await supabase
    .from("streams")
    .select("id, status")
    .eq("id", stream_id)
    .maybeSingle();
  if (streamErr) {
    return NextResponse.json({ error: streamErr.message }, { status: 500 });
  }
  if (!stream) {
    return NextResponse.json({ error: "stream not found" }, { status: 404 });
  }
  if (stream.status === "ended") {
    return NextResponse.json({ error: "配信が終了しました" }, { status: 400 });
  }

  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      mode: "payment",
      currency: "jpy",
      redirect_on_completion: "never",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: amount,
            product_data: { name: `奉納音叉 ${tier.label}` },
          },
        },
      ],
      metadata: {
        stream_id,
        nickname,
        avatar: String(avatar),
        color: String(color),
        body,
        fork_amount: String(amount),
      },
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
