"use client";

import { House, Sparkles, UserRound } from "lucide-react";
import { MotionConfig } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { AppNavContext, type AppNav, type TabId } from "@/components/app-context";
import { LogFlowProvider } from "@/components/log/log-flow";
import { Onboarding } from "@/components/onboarding";
import { AiMealsScreen } from "@/components/screens/ai-meals-screen";
import { HomeScreen } from "@/components/screens/home-screen";
import { ProfileScreen } from "@/components/screens/profile-screen";
import { GlobalSearch } from "@/components/search/global-search";
import SmoothTab, { type TabItem } from "@/components/smooth-tab";
import { StoreProvider, useStore } from "@/lib/store";

const tabs: TabItem[] = [
  { id: "ai-meals", title: "AI Meals", icon: Sparkles, content: <AiMealsScreen /> },
  { id: "home", title: "Home", icon: House, content: <HomeScreen /> },
  { id: "profile", title: "Profile", icon: UserRound, content: <ProfileScreen /> },
];

function Shell() {
  const store = useStore();
  const [tab, setTab] = useState<TabId>("home");
  const [search, setSearch] = useState({ open: false, query: "", key: 0 });

  const goTo = useCallback((next: TabId, sectionId?: string) => {
    setTab(next);
    if (sectionId) {
      // Wait for the tab to slide in, then scroll the section into view.
      setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" }), 320);
    }
  }, []);
  const openSearch = useCallback(
    (query = "") => setSearch((s) => ({ open: true, query, key: s.key + 1 })),
    [],
  );
  const nav = useMemo<AppNav>(() => ({ tab, goTo, openSearch }), [tab, goTo, openSearch]);

  if (!store.ready) {
    return (
      <div className="flex h-dvh items-center justify-center" aria-busy="true">
        <span className="text-sm font-semibold tracking-[0.2em] text-text-3">TARE</span>
      </div>
    );
  }
  if (!store.profile?.onboarded_at) return <Onboarding />;

  return (
    <AppNavContext.Provider value={nav}>
      <LogFlowProvider>
        <SmoothTab items={tabs} selected={tab} onSelect={(id) => setTab(id as TabId)} />
        <GlobalSearch
          key={search.key}
          open={search.open}
          initialQuery={search.query}
          onClose={() => setSearch((s) => ({ ...s, open: false }))}
        />
      </LogFlowProvider>
    </AppNavContext.Provider>
  );
}

export function AppShell() {
  return (
    // Honour the iPhone "Reduce Motion" setting for every animation.
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </MotionConfig>
  );
}
