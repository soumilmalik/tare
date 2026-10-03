import { NextResponse } from "next/server";

/**
 * Mints a short-lived, single-use ElevenLabs token for realtime speech-to-text.
 * The phone connects to ElevenLabs with this; the real API key stays here.
 * (The proxy already rejects signed-out requests to /api/*.)
 */
export async function POST() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "Voice isn't set up yet." }, { status: 501 });

  const res = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
    method: "POST",
    headers: { "xi-api-key": key },
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string };
  if (!res.ok || !data.token) {
    return NextResponse.json({ error: "Voice isn't available right now." }, { status: 502 });
  }
  return NextResponse.json({ token: data.token });
}
