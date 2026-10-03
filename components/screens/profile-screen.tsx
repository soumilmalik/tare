"use client";

import { useState } from "react";
import { useAppNav } from "@/components/app-context";
import { PantryEditor } from "@/components/pantry-editor";
import { Insights, MonthlySummary, useDays } from "@/components/profile/insights";
import {
  CreatineSection,
  DetailsSection,
  ExportSection,
  FoodsSection,
  HistorySection,
  NotificationsSection,
  Section,
  TargetsSection,
  UsageSection,
} from "@/components/profile/sections";
import { secondaryButton } from "@/components/ui/fields";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { Screen } from "./screen";

export function ProfileScreen() {
  const { profile, email } = useStore();
  const { tab } = useAppNav();
  const active = tab === "profile";
  const { days, weights } = useDays(active);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    try {
      // Cached data belongs to the signed-out user.
      for (const k of Object.keys(localStorage)) if (k.startsWith("tare.")) localStorage.removeItem(k);
    } catch {}
    window.location.replace("/login");
  }

  return (
    <Screen title={profile?.name || "Profile"} subtitle={<span className="truncate">{email}</span>}>
      <DetailsSection />
      <TargetsSection />
      <FoodsSection />
      <Section id="pantry-profile" title="Usually at home">
        <PantryEditor />
      </Section>
      <CreatineSection />
      <NotificationsSection />

      <Section id="insights" title="Insights">
        <div className="space-y-6">
          <MonthlySummary active={active} />
          <Insights days={days} weights={weights} />
        </div>
      </Section>

      <ExportSection />
      <UsageSection active={active} />

      <button type="button" onClick={signOut} disabled={signingOut} className={`${secondaryButton} mt-10`}>
        {signingOut ? "Signing out…" : "Sign out"}
      </button>

      <HistorySection days={days} />
    </Screen>
  );
}
