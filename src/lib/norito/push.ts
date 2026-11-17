import webpush from "web-push";
import { getAdminClient } from "@/lib/supabase/admin";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured = false;
export function vapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:noreply@example.com", pub, priv);
  configured = true;
  return true;
}

/** 通知を送る。届かなくなった宛先（410/404）は消す。 */
export async function sendPush(
  payload: PushPayload,
  opts: { membersOnly?: boolean } = {},
): Promise<{ sent: number; failed: number; removed: number; configured: boolean }> {
  if (!configure()) return { sent: 0, failed: 0, removed: 0, configured: false };
  const supabase = getAdminClient();
  let q = supabase.from("norito_push_subs").select("endpoint,p256dh,auth");
  if (opts.membersOnly) q = q.eq("member", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  const subs = data ?? [];
  const BATCH = 50;
  for (let i = 0; i < subs.length; i += BATCH) {
    await Promise.all(
      subs.slice(i, i + BATCH).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60 * 6 },
          );
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(s.endpoint);
          else failed++;
        }
      }),
    );
  }
  if (gone.length) await supabase.from("norito_push_subs").delete().in("endpoint", gone);
  return { sent, failed, removed: gone.length, configured: true };
}
