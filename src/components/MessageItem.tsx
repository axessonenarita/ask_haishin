import { getAvatarEmoji, getColorHex, type Role } from "@/lib/constants";
import type { Message } from "@/lib/types";

function RoleBadge({ role }: { role: Role }) {
  if (role === "admin") {
    return (
      <span className="mr-1 inline-block rounded bg-role-adminGold/20 px-1.5 py-0.5 text-[10px] font-bold text-role-adminGold">
        運営
      </span>
    );
  }
  if (role === "staff") {
    return (
      <span className="mr-1 inline-block rounded bg-role-staff/20 px-1.5 py-0.5 text-[10px] font-bold text-role-staff">
        STAFF
      </span>
    );
  }
  return null;
}

function nameColor(m: Message): string {
  if (m.role === "admin") return "#d4af37";
  if (m.role === "staff") return "#3b82f6";
  return getColorHex(m.color);
}

export function MessageItem({ message }: { message: Message }) {
  const emoji = getAvatarEmoji(message.avatar);
  const color = nameColor(message);

  return (
    <div className="break-words px-3 py-1.5 text-[15px] leading-relaxed">
      <RoleBadge role={message.role} />
      <span className="mr-1">{emoji}</span>
      <span className="font-bold" style={{ color }}>
        {message.nickname}
      </span>
      <span className="text-neutral-400">：</span>
      <span className="text-neutral-100">{message.body}</span>
    </div>
  );
}
