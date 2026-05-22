import {
  AVATAR_IDS,
  BANNED_WORDS,
  COLOR_IDS,
  MAX_BODY_LENGTH,
  MAX_NICKNAME_LENGTH,
  type AvatarId,
  type ColorId,
} from "./constants";

export function isAvatarId(v: unknown): v is AvatarId {
  return typeof v === "string" && (AVATAR_IDS as readonly string[]).includes(v);
}

export function isColorId(v: unknown): v is ColorId {
  return typeof v === "string" && (COLOR_IDS as readonly string[]).includes(v);
}

export function sanitizeNickname(v: string): string {
  return v.trim().slice(0, MAX_NICKNAME_LENGTH);
}

export function sanitizeBody(v: string): string {
  return v.trim().slice(0, MAX_BODY_LENGTH);
}

export function containsBannedWord(body: string): boolean {
  return BANNED_WORDS.some((w) => body.includes(w));
}
