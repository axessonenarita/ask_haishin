import { getAdminClient } from "@/lib/supabase/admin";
import { buildSchedule } from "./schedule";
import { keyMatches, loadSettings } from "./settings";
import { vapidPublicKey } from "./push";
import type { NoritoContent } from "./types";

export async function loadContent(key: string | null): Promise<NoritoContent> {
  const supabase = getAdminClient();
  const { settings } = await loadSettings();
  const member = keyMatches(key, settings.member_key);

  let prayersQ = supabase.from("norito_prayers").select("*").eq("published", true).order("sort").order("created_at");
  let videosQ = supabase.from("norito_videos").select("*").order("aired_on", { ascending: false, nullsFirst: false }).order("sort");
  if (!member) {
    prayersQ = prayersQ.eq("members_only", false);
    videosQ = videosQ.eq("members_only", false);
  }
  const nowIso = new Date().toISOString();
  const lockedQ = member
    ? Promise.resolve([0, 0])
    : Promise.all([
        supabase.from("norito_prayers").select("id", { count: "exact", head: true }).eq("published", true).eq("members_only", true),
        supabase.from("norito_videos").select("id", { count: "exact", head: true }).eq("members_only", true),
      ]).then(([a, b]) => [a.count ?? 0, b.count ?? 0]);
  const [prayers, videos, letters, events, posts, locked] = await Promise.all([
    prayersQ,
    videosQ.limit(500),
    supabase.from("norito_letters").select("id,title,body,published_at,notified_at").lte("published_at", nowIso).order("published_at", { ascending: false }).limit(30),
    supabase.from("norito_events").select("*").gte("start_at", new Date(Date.now() - 3 * 3600_000).toISOString()).order("start_at").limit(50),
    supabase.from("norito_salon_posts").select("*").order("posted_at", { ascending: false }).limit(20),
    lockedQ,
  ]);

  return {
    member,
    prayers: prayers.data ?? [],
    videos: videos.data ?? [],
    letters: letters.data ?? [],
    schedule: buildSchedule(events.data ?? [], {
      skipDates: settings.skip_dates,
      youtubeUrl: settings.youtube_url,
      salonUrl: "/api/norito/go?from=schedule",
    }),
    posts: (posts.data ?? []).map((p) => ({ ...p, url: member ? p.url : null })),
    locked: { prayers: locked[0], videos: locked[1] },
    vapidPublicKey: vapidPublicKey(),
  };
}
