"use client";

import { useEffect, useState } from "react";

let cachedOffset = 0;
let lastSyncAt = 0;

const RESYNC_INTERVAL_MS = 5 * 60 * 1000;
const TICK_INTERVAL_MS = 1000;

async function syncOffset(): Promise<void> {
  const clientBefore = Date.now();
  try {
    const res = await fetch("/api/time", { cache: "no-store" });
    const clientAfter = Date.now();
    if (!res.ok) return;
    const data = (await res.json()) as { now?: number };
    if (typeof data.now !== "number") return;
    const clientMid = (clientBefore + clientAfter) / 2;
    cachedOffset = data.now - clientMid;
    lastSyncAt = Date.now();
  } catch {
    // ignore, keep previous offset
  }
}

export function getServerNow(): number {
  return Date.now() + cachedOffset;
}

export function useServerTime(): number {
  const [now, setNow] = useState<number>(() => getServerNow());

  useEffect(() => {
    let mounted = true;

    const runSync = async () => {
      await syncOffset();
      if (mounted) setNow(getServerNow());
    };

    if (Date.now() - lastSyncAt > RESYNC_INTERVAL_MS) {
      void runSync();
    }

    const tickTimer = setInterval(() => {
      setNow(getServerNow());
    }, TICK_INTERVAL_MS);

    const resyncTimer = setInterval(() => {
      void runSync();
    }, RESYNC_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(tickTimer);
      clearInterval(resyncTimer);
    };
  }, []);

  return now;
}
