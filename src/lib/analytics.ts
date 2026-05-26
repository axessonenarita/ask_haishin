"use client";

import { sendGAEvent } from "@next/third-parties/google";

// GA未設定時もエラーにならないように try で包む
export function trackEvent(
  name: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  try {
    sendGAEvent("event", name, params ?? {});
  } catch {
    // GA未ロード時等は無視
  }
}
