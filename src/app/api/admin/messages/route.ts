import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { ROLES, type Role } from "@/lib/constants";
import {
  isAvatarId,
  isColorId,
  sanitizeBody,
  sanitizeNickname,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const p = payload as Record<string, unknown>;
  const nickname = sanitizeNickname(String(p.nickname ?? ""));
  const body = sanitizeBody(String(p.body ?? ""));
  const avatar = p.avatar;
  const color = p.color;
  const role = p.role as Role;
  const stream_id = typeof p.stream_id === "string" ? p.stream_id : "";
  const pinned = p.pinned === true;

  if (!nickname) {
    return NextResponse.json({ error: "nickname required" }, { status: 400 });
  }
  if (!body) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }
  if (!isAvatarId(avatar)) {
    return NextResponse.json({ error: "invalid avatar" }, { status: 400 });
  }
  if (!isColorId(color)) {
    return NextResponse.json({ error: "invalid color" }, { status: 400 });
  }
  if (!(ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }
  if (!stream_id) {
    return NextResponse.json({ error: "stream_id required" }, { status: 400 });
  }
  // pinned は admin/staff のみ許可
  if (pinned && role !== "admin" && role !== "staff") {
    return NextResponse.json(
      { error: "pinned messages must be admin or staff" },
      { status: 400 },
    );
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      nickname,
      avatar,
      color,
      body,
      role,
      deleted: false,
      pinned,
      stream_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ message: data });
}
