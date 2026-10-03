"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Screen } from "./screen";

export function ProfileScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    window.location.replace("/login");
  }

  return (
    <Screen title="Profile">
      <p className="mt-1 h-5 truncate text-sm text-text-2">{email}</p>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="mt-10 h-12 w-full rounded-xl border border-line bg-surface text-text-1 transition-opacity active:opacity-80 disabled:opacity-40"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </Screen>
  );
}
