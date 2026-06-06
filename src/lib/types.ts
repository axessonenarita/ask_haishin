import type { Role } from "./constants";

export type Message = {
  id: string;
  nickname: string;
  avatar: string;
  color: string;
  body: string;
  role: Role;
  created_at: string;
  deleted: boolean;
  pinned: boolean;
  stream_id: string | null;
};

export type UserProfile = {
  nickname: string;
  avatar: string;
  color: string;
};

export type StreamStatus = "waiting" | "live" | "ended";

export type Stream = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  start_at: string;
  hls_url: string;
  status: StreamStatus;
  inflation_boost_start: number | null;
  inflation_real_max: number | null;
  inflation_target_max: number | null;
};
