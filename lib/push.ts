"use client";

import { createClient } from "@/lib/supabase/client";

/** iPhone only allows web push for apps added to the Home Screen (iOS 16.4+). */
export function pushSupport(): "ok" | "install-first" | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !standalone) return "install-first";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return "ok";
}

export function pushPermission(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Asks permission and saves this device's push subscription. Returns an error message or null. */
export async function enablePush(): Promise<string | null> {
  const support = pushSupport();
  if (support === "install-first") return "Add Tare to your Home Screen first, then open it from there.";
  if (support === "unsupported") return "This browser doesn't support notifications.";

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "Notifications aren't set up on the server yet.";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "Notifications are blocked. Allow them in iPhone Settings → Tare.";

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return "The app isn't fully installed yet. Reopen Tare and try again.";

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));

  const json = subscription.toJSON();
  const { error } = await createClient()
    .from("push_subscriptions")
    .upsert({ endpoint: json.endpoint, subscription: json }, { onConflict: "endpoint" });
  return error ? error.message : null;
}
