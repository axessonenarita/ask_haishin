export type DonationTier = {
  amount: number;
  label: string;
  color: string;
  textColor: string;
  maxBodyLength: number;
  bannerHoldSec: number;
  iconCount: number;
  hasSparkle: boolean;
  hasFullscreenPulse: boolean;
};

export const DONATION_TIERS: DonationTier[] = [
  { amount: 100, label: "¥100", color: "#1e88e5", textColor: "#ffffff", maxBodyLength: 0, bannerHoldSec: 5, iconCount: 1, hasSparkle: false, hasFullscreenPulse: false },
  { amount: 200, label: "¥200", color: "#00b8d4", textColor: "#ffffff", maxBodyLength: 50, bannerHoldSec: 5, iconCount: 1, hasSparkle: false, hasFullscreenPulse: false },
  { amount: 500, label: "¥500", color: "#00c853", textColor: "#ffffff", maxBodyLength: 100, bannerHoldSec: 10, iconCount: 2, hasSparkle: false, hasFullscreenPulse: false },
  { amount: 1000, label: "¥1,000", color: "#ffd600", textColor: "#1a1a1a", maxBodyLength: 200, bannerHoldSec: 15, iconCount: 3, hasSparkle: false, hasFullscreenPulse: false },
  { amount: 2000, label: "¥2,000", color: "#ff9100", textColor: "#ffffff", maxBodyLength: 200, bannerHoldSec: 20, iconCount: 4, hasSparkle: true, hasFullscreenPulse: false },
  { amount: 5000, label: "¥5,000", color: "#ec407a", textColor: "#ffffff", maxBodyLength: 300, bannerHoldSec: 30, iconCount: 5, hasSparkle: true, hasFullscreenPulse: false },
  { amount: 10000, label: "¥10,000", color: "#e53935", textColor: "#ffffff", maxBodyLength: 300, bannerHoldSec: 60, iconCount: 6, hasSparkle: true, hasFullscreenPulse: false },
  { amount: 20000, label: "¥20,000", color: "#b71c1c", textColor: "#ffffff", maxBodyLength: 300, bannerHoldSec: 90, iconCount: 8, hasSparkle: true, hasFullscreenPulse: false },
  { amount: 50000, label: "¥50,000", color: "#d4af37", textColor: "#1a1a1a", maxBodyLength: 300, bannerHoldSec: 120, iconCount: 10, hasSparkle: true, hasFullscreenPulse: true },
];

export const DONATION_AMOUNTS = DONATION_TIERS.map((t) => t.amount);

export function findTier(amount: number): DonationTier | null {
  return DONATION_TIERS.find((t) => t.amount === amount) ?? null;
}

export function isValidDonationAmount(amount: unknown): amount is number {
  return typeof amount === "number" && DONATION_AMOUNTS.includes(amount);
}

export function tierForAmount(amount: number): DonationTier {
  let match = DONATION_TIERS[0];
  for (const t of DONATION_TIERS) {
    if (t.amount <= amount) match = t;
  }
  return match;
}
