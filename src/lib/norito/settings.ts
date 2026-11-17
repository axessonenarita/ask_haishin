import { getAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_SALON_URL = "https://lounge.dmm.com/detail/10704/";

export type NoritoSettings = {
  member_key: string | null;
  salon_url: string;
  youtube_url: string | null;
  skip_dates: string[];
  sunday_notify_all: boolean;
  [key: string]: unknown;
};

export async function loadSettings(): Promise<{ settings: NoritoSettings; raw: Record<string, string> }> {
  const supabase = getAdminClient();
  const { data } = await supabase.from("norito_settings").select("key,value");
  const raw: Record<string, string> = {};
  for (const r of data ?? []) raw[r.key as string] = r.value as string;
  return {
    raw,
    settings: {
      member_key: raw.member_key?.trim() || null,
      salon_url: raw.salon_url?.trim() || DEFAULT_SALON_URL,
      youtube_url: raw.youtube_url?.trim() || null,
      skip_dates: (raw.skip_dates ?? "")
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
      sunday_notify_all: raw.sunday_notify_all === "1",
    },
  };
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("norito_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function keyMatches(given: string | null | undefined, expected: string | null): boolean {
  if (!given || !expected) return false;
  return timingSafeEqual(given, expected);
}

/** 会員用URLの鍵（推測されにくい英数字20文字） */
export function newMemberKey(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
