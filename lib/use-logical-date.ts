"use client";

import { useSyncExternalStore } from "react";
import { logicalDate } from "@/lib/dates";

// Re-check when the app returns to the foreground, so the day rolls over at
// 3 AM even if the PWA was left open in the background overnight.
function subscribe(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** Today's logical date (YYYY-MM-DD), or null during server rendering. */
export function useLogicalDate(timeZone?: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => logicalDate(new Date(), timeZone),
    () => null,
  );
}
