import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  if (!params.slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { data: stream, error: fetchError } = await supabase
    .from("streams")
    .select("id, status, start_at")
    .eq("slug", params.slug)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!stream) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (stream.status === "ended") {
    return NextResponse.json({ ok: true, already: true });
  }
  if (Date.now() < new Date(stream.start_at as string).getTime()) {
    return NextResponse.json(
      { error: "stream has not started yet" },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("streams")
    .update({ status: "ended" })
    .eq("id", stream.id)
    .neq("status", "ended");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
