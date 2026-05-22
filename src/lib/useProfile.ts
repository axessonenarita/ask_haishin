"use client";

import { useCallback, useEffect, useState } from "react";
import { LS_KEYS } from "./constants";
import { isAvatarId, isColorId, sanitizeNickname } from "./validation";
import type { UserProfile } from "./types";

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const nickname = localStorage.getItem(LS_KEYS.nickname);
      const avatar = localStorage.getItem(LS_KEYS.avatar);
      const color = localStorage.getItem(LS_KEYS.color);
      if (
        nickname &&
        avatar &&
        color &&
        isAvatarId(avatar) &&
        isColorId(color)
      ) {
        setProfile({
          nickname: sanitizeNickname(nickname),
          avatar,
          color,
        });
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  const save = useCallback((p: UserProfile) => {
    const nickname = sanitizeNickname(p.nickname);
    if (!nickname || !isAvatarId(p.avatar) || !isColorId(p.color)) return;
    const next: UserProfile = { nickname, avatar: p.avatar, color: p.color };
    try {
      localStorage.setItem(LS_KEYS.nickname, next.nickname);
      localStorage.setItem(LS_KEYS.avatar, next.avatar);
      localStorage.setItem(LS_KEYS.color, next.color);
    } catch {
      // ignore
    }
    setProfile(next);
  }, []);

  return { profile, loaded, save };
}
