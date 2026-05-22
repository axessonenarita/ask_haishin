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
  start_at: string;
  hls_url: string;
  status: StreamStatus;
};
