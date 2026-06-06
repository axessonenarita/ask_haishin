"use client";

import { useState } from "react";
import { AdminMessages } from "./AdminMessages";
import { AdminStreams } from "./AdminStreams";
import { SentryTestPanel } from "./SentryTestPanel";

type Tab = "streams" | "messages" | "settings";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "streams", label: "配信", emoji: "📺" },
  { id: "messages", label: "コメント", emoji: "💬" },
  { id: "settings", label: "設定", emoji: "⚙️" },
];

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("streams");

  return (
    <div className="min-h-screen bg-bg-base text-white">
      <header className="sticky top-0 z-10 border-b border-bg-border bg-bg-base/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <h1 className="text-lg font-bold tracking-tight">管理画面</h1>
          <nav className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold transition ${
                  tab === t.id
                    ? "bg-blue-600 text-white"
                    : "text-neutral-300 hover:bg-bg-input"
                }`}
              >
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {tab === "streams" && <AdminStreams />}
        {tab === "messages" && <AdminMessages />}
        {tab === "settings" && <SentryTestPanel />}
      </main>
    </div>
  );
}
