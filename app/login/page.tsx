"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 60;

const CALLBACK_ERRORS: Record<string, string> = {
  not_allowed: "This account doesn't have access to Tare.",
  failed: "Google sign-in didn't complete. Please try again.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const callbackError = CALLBACK_ERRORS[useSearchParams().get("error") ?? ""] ?? null;

  const [step, setStep] = useState<"choose" | "email" | "code">("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(callbackError);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    // On success the browser is already leaving for Google.
    if (error) {
      setBusy(false);
      setError(friendlyError(error.message));
    }
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setEmail(address);
    setCode("");
    setStep("code");
    setCooldown(RESEND_SECONDS);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email, token: code, type: "email" });
    if (error) {
      setBusy(false);
      return setError(friendlyError(error.message));
    }
    // Full navigation so the server sees the new session cookie.
    window.location.replace("/");
  }

  const back = (to: "choose" | "email") => () => {
    setStep(to);
    setError(null);
  };

  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-lg font-semibold tracking-[0.2em]">TARE</h1>

        {step === "choose" && (
          <div className="mt-10 space-y-3">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              className={`${primaryButton} flex items-center justify-center gap-3`}
            >
              <GoogleMark />
              {busy ? "Opening Google…" : "Continue with Google"}
            </button>
            <button
              type="button"
              onClick={back("email")}
              disabled={busy}
              className="min-h-11 w-full text-sm text-text-2"
            >
              Use email code instead
            </button>
          </div>
        )}

        {step === "email" && (
          <form onSubmit={sendCode} className="mt-10 space-y-3">
            <label htmlFor="email" className="block text-sm text-text-2">
              We&apos;ll email you a 6-digit code.
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <button type="submit" disabled={busy || !email.trim()} className={primaryButton}>
              {busy ? "Sending…" : "Send code"}
            </button>
            <button type="button" onClick={back("choose")} className="min-h-11 w-full text-sm text-text-2">
              Back
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verify} className="mt-10 space-y-3">
            <label htmlFor="code" className="block text-sm text-text-2">
              Enter the code sent to <span className="text-text-1">{email}</span>
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              autoFocus
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} text-center text-2xl tracking-[0.4em]`}
            />
            <button type="submit" disabled={busy || code.length < 6} className={primaryButton}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <div className="flex justify-between pt-2 text-sm">
              <button type="button" onClick={back("email")} className="min-h-11 text-text-2">
                Change email
              </button>
              <button
                type="button"
                disabled={busy || cooldown > 0}
                onClick={() => sendCode()}
                className="min-h-11 text-text-2 disabled:text-text-3"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <p role="alert" aria-live="polite" className="mt-4 min-h-5 text-sm text-text-2">
          {error}
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.98-4.32 2.98-7.35ZM12 22c2.7 0 4.96-.9 6.62-2.42l-3.23-2.5c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.07v2.6A10 10 0 0 0 12 22Zm-5.6-7.1a6 6 0 0 1 0-3.8V8.5H3.07a10 10 0 0 0 0 9l3.33-2.6ZM12 5.98c1.47 0 2.79.5 3.83 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.5L6.4 10.1C7.19 7.74 9.4 5.98 12 5.98Z" />
    </svg>
  );
}

function friendlyError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("saving new user") || m.includes("not_allowed")) {
    return "This email doesn't have access to Tare.";
  }
  if (m.includes("rate limit") || m.includes("security purposes")) {
    return "Too many codes requested. Wait a minute and try again.";
  }
  if (m.includes("expired") || m.includes("invalid")) {
    return "That code didn't work. Check it, or request a new one.";
  }
  if (m.includes("provider is not enabled")) {
    return "Google sign-in isn't switched on yet.";
  }
  if (m.includes("fetch") || m.includes("network")) {
    return "Can't reach the server. Check your internet connection.";
  }
  return message;
}

const inputClass =
  "h-12 w-full rounded-xl border border-line bg-surface px-4 text-text-1 placeholder:text-text-3 outline-none focus:border-text-3";
const primaryButton =
  "h-12 w-full rounded-xl bg-text-1 font-medium text-bg transition-opacity active:opacity-80 disabled:opacity-40";
