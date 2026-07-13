import { getAvatarEmoji, getColorHex, type Role } from "@/lib/constants";
import { tierForAmount } from "@/lib/donation";
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

  if (message.fork_amount > 0) {
    const tier = tierForAmount(message.fork_amount);
    return (
      <div className="px-2 py-1">
        <div
          className="break-words rounded-lg px-3 py-2 shadow"
          style={{ backgroundColor: tier.color, color: tier.textColor }}
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <span aria-hidden>{emoji}</span>
            <span className="truncate">{message.nickname}</span>
            <span className="ml-auto shrink-0 rounded bg-black/25 px-2 py-0.5 text-xs">
              {tier.label} 奉納
            </span>
          </div>
          {message.body && (
            <div className="mt-1 whitespace-pre-wrap break-words text-[15px]">
              {message.body}
            </div>
          )}
        </div>
      </div>
    );
  }

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
