"use client";

import { useState } from "react";
import { AVATARS, COLORS, MAX_NICKNAME_LENGTH } from "@/lib/constants";
import { sanitizeNickname } from "@/lib/validation";
import type { UserProfile } from "@/lib/types";

type Props = {
  initial?: UserProfile | null;
  title: string;
  submitLabel: string;
  onSubmit: (p: UserProfile) => void;
  onClose?: () => void;
};

export function ProfileSetup({
  initial,
  title,
  submitLabel,
  onSubmit,
  onClose,
}: Props) {
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [avatar, setAvatar] = useState(initial?.avatar ?? AVATARS[0].id);
  const [color, setColor] = useState(initial?.color ?? COLORS[0].id);

  const canSubmit = sanitizeNickname(nickname).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl bg-bg-panel p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-neutral-400 hover:text-white"
              aria-label="閉じる"
            >
              ✕
            </button>
          )}
        </div>

        <label className="mb-1 block text-sm text-neutral-300">
          ニックネーム
        </label>
        <input
          type="text"
          value={nickname}
          maxLength={MAX_NICKNAME_LENGTH}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="例：参拝者A"
          className="mb-4 w-full rounded-md bg-bg-input px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="mb-1 text-sm text-neutral-300">アイコン</div>
        <div className="mb-4 grid grid-cols-5 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAvatar(a.id)}
              className={`flex h-12 items-center justify-center rounded-md text-2xl transition ${
                avatar === a.id
                  ? "bg-blue-600 ring-2 ring-blue-400"
                  : "bg-bg-input hover:bg-neutral-700"
              }`}
              aria-pressed={avatar === a.id}
              aria-label={a.id}
            >
              {a.emoji}
            </button>
          ))}
        </div>

        <div className="mb-1 text-sm text-neutral-300">カラー</div>
        <div className="mb-6 grid grid-cols-4 gap-2">
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.id)}
              className={`flex h-10 items-center justify-center rounded-md text-xs font-bold transition ${
                color === c.id
                  ? "ring-2 ring-white"
                  : "ring-1 ring-neutral-700"
              }`}
              style={{ backgroundColor: c.hex, color: "#0f0f10" }}
              aria-pressed={color === c.id}
              aria-label={c.label}
            >
              {c.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({ nickname: sanitizeNickname(nickname), avatar, color })
          }
          className="w-full rounded-md bg-blue-600 py-2 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
