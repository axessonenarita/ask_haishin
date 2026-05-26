import { unstable_noStore as noStore } from "next/cache";
import { getServerClient } from "./supabase/server";
import type { Stream } from "./types";

export async function fetchActiveStream(): Promise<Stream | null> {
  noStore();
  const supabase = getServerClient();

  const active = await supabase
    .from("streams")
    .select("*")
    .neq("status", "ended")
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (active.data) return active.data as Stream;

  const ended = await supabase
    .from("streams")
    .select("*")
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (ended.data as Stream | null) ?? null;
}

export async function fetchStreamBySlug(slug: string): Promise<Stream | null> {
  noStore();
  const supabase = getServerClient();
  const { data } = await supabase
    .from("streams")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Stream | null) ?? null;
}
