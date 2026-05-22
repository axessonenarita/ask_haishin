export const AVATARS = [
  { id: "rabbit", emoji: "🐰" },
  { id: "bear", emoji: "🐻" },
  { id: "dog", emoji: "🐶" },
  { id: "owl", emoji: "🦉" },
  { id: "moon", emoji: "🌙" },
  { id: "sun", emoji: "☀️" },
  { id: "flame", emoji: "🔥" },
  { id: "crystal", emoji: "🔮" },
  { id: "torii", emoji: "⛩️" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export const COLORS = [
  { id: "purple", hex: "#a855f7", label: "紫" },
  { id: "blue", hex: "#3b82f6", label: "青" },
  { id: "red", hex: "#ef4444", label: "赤" },
  { id: "green", hex: "#22c55e", label: "緑" },
  { id: "gold", hex: "#d4af37", label: "金" },
  { id: "silver", hex: "#c0c0c0", label: "銀" },
  { id: "pink", hex: "#ec4899", label: "桃" },
  { id: "black", hex: "#9ca3af", label: "黒" },
] as const;

export type ColorId = (typeof COLORS)[number]["id"];

export const AVATAR_IDS = AVATARS.map((a) => a.id) as readonly AvatarId[];
export const COLOR_IDS = COLORS.map((c) => c.id) as readonly ColorId[];

export const ROLES = ["user", "staff", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const BANNED_WORDS = ["荒らし", "死ね", "殺す"];

export const RATE_LIMIT_MS = 5000;
export const MAX_BODY_LENGTH = 300;
export const MAX_NICKNAME_LENGTH = 20;
export const INITIAL_LOAD_LIMIT = 100;

export const LS_KEYS = {
  nickname: "ask_haishin_nickname",
  avatar: "ask_haishin_avatar",
  color: "ask_haishin_color",
  lastPostAt: "ask_haishin_last_post_at",
} as const;

export function getAvatarEmoji(id: string): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? "🐰";
}

export function getColorHex(id: string): string {
  return COLORS.find((c) => c.id === id)?.hex ?? "#e5e5e5";
}
