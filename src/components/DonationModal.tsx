"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import {
  DONATION_TIERS,
  tierForAmount,
  type DonationTier,
} from "@/lib/donation";
import { getStripeClient } from "@/lib/stripe/client";
import type { UserProfile } from "@/lib/types";
import { getAvatarEmoji, getColorHex } from "@/lib/constants";

type Props = {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  streamId: string;
};

// 老人配慮: 大きい文字 / 大きいボタン。スライダーはインデックス(0..8)で動かし、
// 各段階でティアを一発切り替え。プレビューでリアルタイムに雰囲気を確認できる。
export function DonationModal({ open, onClose, profile, streamId }: Props) {
  const [tierIdx, setTierIdx] = useState<number>(3); // 初期は ¥1,000
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<"configure" | "checkout" | "done">(
    "configure",
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTierIdx(3);
      setBody("");
      setPhase("configure");
      setClientSecret(null);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const tier: DonationTier = useMemo(
    () => DONATION_TIERS[tierIdx] ?? DONATION_TIERS[0],
    [tierIdx],
  );

  // ティア変更で本文長がオーバーしたら自動でカット
  useEffect(() => {
    if (body.length > tier.maxBodyLength) {
      setBody((b) => b.slice(0, tier.maxBodyLength));
    }
  }, [tier.maxBodyLength, body.length]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/donations/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream_id: streamId,
          amount: tier.amount,
          nickname: profile.nickname,
          avatar: profile.avatar,
          color: profile.color,
          body: body.trim(),
        }),
      });
      const json = (await res.json()) as {
        clientSecret?: string;
        error?: string;
      };
      if (!res.ok || !json.clientSecret) {
        setError(json.error || "決済の準備に失敗しました");
        setSubmitting(false);
        return;
      }
      setClientSecret(json.clientSecret);
      setPhase("checkout");
      setSubmitting(false);
    } catch {
      setError("通信エラーが起きました");
      setSubmitting(false);
    }
  }, [body, profile.avatar, profile.color, profile.nickname, streamId, tier.amount]);

  const stripePromise = useMemo(() => getStripeClient(), []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center">
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-bg-panel shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-bg-border px-4 py-3">
          <h2 className="text-lg font-bold text-white">奉納音叉</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-neutral-300 hover:bg-bg-input"
            aria-label="閉じる"
          >
            閉じる
          </button>
        </div>

        {phase === "configure" && (
          <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-4">
            {/* プレビュー */}
            <div
              className="rounded-lg p-3 shadow-inner"
              style={{ backgroundColor: tier.color, color: tier.textColor }}
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                <span aria-hidden>{getAvatarEmoji(profile.avatar)}</span>
                <span style={{ color: tier.textColor }}>
                  {profile.nickname}
                </span>
                <span className="ml-auto rounded bg-black/20 px-2 py-0.5 text-xs">
                  {tier.label} 奉納
                </span>
              </div>
              {tier.maxBodyLength > 0 && (
                <div className="mt-2 min-h-[2.5rem] whitespace-pre-wrap break-words text-base">
                  {body || (
                    <span className="opacity-60">
                      ここにメッセージが表示されます
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 金額スライダー */}
            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                奉納額
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={DONATION_TIERS.length - 1}
                  step={1}
                  value={tierIdx}
                  onChange={(e) => setTierIdx(Number(e.target.value))}
                  className="flex-1 accent-amber-500"
                  aria-label="奉納額スライダー"
                />
                <div
                  className="min-w-[6rem] rounded-md px-3 py-2 text-center text-lg font-bold shadow"
                  style={{
                    backgroundColor: tier.color,
                    color: tier.textColor,
                  }}
                >
                  {tier.label}
                </div>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
                <span>¥100</span>
                <span>¥50,000</span>
              </div>
            </div>

            {/* 本文 */}
            {tier.maxBodyLength > 0 ? (
              <div>
                <label className="mb-1 flex items-center justify-between text-sm text-neutral-300">
                  <span>メッセージ (任意)</span>
                  <span className="text-[10px] text-neutral-500">
                    {body.length} / {tier.maxBodyLength}
                  </span>
                </label>
                <textarea
                  value={body}
                  maxLength={tier.maxBodyLength}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="添えるメッセージがあれば"
                  className="w-full rounded-md bg-bg-input px-3 py-2 text-base outline-none"
                />
              </div>
            ) : (
              <div className="text-sm text-neutral-400">
                この金額ではメッセージは付けられません。上のスライダーを ¥200 以上に上げるとメッセージを添えられます。
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-900 bg-red-950/70 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-2 rounded-lg bg-amber-600 px-4 py-3 text-lg font-bold text-white shadow hover:bg-amber-500 active:scale-[0.98] disabled:opacity-60"
              style={{
                paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
              }}
            >
              {submitting
                ? "決済画面を開いています…"
                : `${tier.label} を奉納する`}
            </button>
            <div className="text-[10px] leading-4 text-neutral-500">
              クレジットカードで決済します。決済処理は Stripe が行い、
              このサイトはカード情報を保持しません。奉納は
              サービス料金として扱われ、原則返金いたしかねます。
            </div>
          </div>
        )}

        {phase === "checkout" && clientSecret && (
          <div className="flex max-h-[85vh] flex-col overflow-y-auto">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{
                clientSecret,
                onComplete: () => setPhase("done"),
              }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="text-5xl">🔔</div>
            <div className="text-lg font-bold text-white">
              ご奉納ありがとうございました
            </div>
            <div className="text-sm text-neutral-400">
              まもなくチャットに反映されます
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-lg bg-amber-600 px-4 py-3 text-base font-bold text-white hover:bg-amber-500"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
