"use client";

import { createContext, useContext } from "react";

export type TabId = "ai-meals" | "home" | "profile";

export interface AppNav {
  tab: TabId;
  /** Switch tab, optionally scrolling to an element id on that tab. */
  goTo: (tab: TabId, sectionId?: string) => void;
  openSearch: (query?: string) => void;
}

export const AppNavContext = createContext<AppNav | null>(null);

export function useAppNav(): AppNav {
  const nav = useContext(AppNavContext);
  if (!nav) throw new Error("useAppNav must be used inside the app shell");
  return nav;
}
