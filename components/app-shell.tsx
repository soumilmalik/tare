"use client";

import { House, Sparkles, UserRound } from "lucide-react";
import { MotionConfig } from "motion/react";
import SmoothTab, { type TabItem } from "@/components/smooth-tab";
import { AiMealsScreen } from "@/components/screens/ai-meals-screen";
import { HomeScreen } from "@/components/screens/home-screen";
import { ProfileScreen } from "@/components/screens/profile-screen";

const tabs: TabItem[] = [
  { id: "ai-meals", title: "AI Meals", icon: Sparkles, content: <AiMealsScreen /> },
  { id: "home", title: "Home", icon: House, content: <HomeScreen /> },
  { id: "profile", title: "Profile", icon: UserRound, content: <ProfileScreen /> },
];

export function AppShell() {
  return (
    // Honour the iPhone "Reduce Motion" setting for every animation.
    <MotionConfig reducedMotion="user">
      <SmoothTab items={tabs} defaultTabId="home" />
    </MotionConfig>
  );
}
