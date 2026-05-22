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
};

export type UserProfile = {
  nickname: string;
  avatar: string;
  color: string;
};
