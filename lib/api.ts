"use client";

/** POST JSON to one of our API routes; throws an Error with a friendly message. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("This needs internet. Connect and try again.");
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't connect. Check your internet and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong. Try again.");
  return data as T;
}
