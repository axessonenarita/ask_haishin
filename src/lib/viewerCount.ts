// 視聴者数表示のかさ増し設定
// 実数 (Supabase Realtime Presence でカウントした人数) を、
// 視聴者向けの表示用に水増しする計算を行う。
// 管理画面では未加工の実数を表示する。

export const VIEWER_COUNT_CONFIG = {
  // この値以下のときは実数をそのまま表示する
  boostStart: 100,
  // 実際に集まる視聴者の想定ピーク値
  realMax: 500,
  // 表示上の目標ピーク値(realMax 到達時に表示される値)
  targetMax: 1000,
};

export type ViewerCountConfig = typeof VIEWER_COUNT_CONFIG;

/**
 * 実視聴者数を水増しした表示用の数値を返す。
 *
 * - actual <= boostStart: そのまま返す(係数 1.0)
 * - boostStart < actual <= realMax: 係数を 1.0 → targetMax/realMax まで
 *   線形補間して掛ける
 * - actual > realMax: ピーク係数(targetMax/realMax)をそのまま掛け続け、
 *   表示は線形に伸び続ける(上限張り付きを避けて自然な増加感を維持)
 */
export function inflateViewerCount(
  actual: number,
  config: ViewerCountConfig = VIEWER_COUNT_CONFIG,
): number {
  if (!Number.isFinite(actual) || actual <= 0) return 0;
  if (actual <= config.boostStart) return Math.round(actual);
  if (config.realMax <= config.boostStart) return Math.round(actual);

  const peakMultiplier = config.targetMax / config.realMax;

  if (actual >= config.realMax) {
    // ピーク係数をそのまま掛け続けるので realMax 通過後も滑らかに伸びる
    return Math.round(actual * peakMultiplier);
  }

  const range = config.realMax - config.boostStart;
  const ratio = (actual - config.boostStart) / range;
  const multiplier = 1 + ratio * (peakMultiplier - 1);
  return Math.round(actual * multiplier);
}
