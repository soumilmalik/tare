"use client";

/**
 * Realtime speech-to-text via ElevenLabs Scribe (WebSocket), same approach as
 * EDITH: streams the mic as 16 kHz PCM and returns live, punctuated text.
 * Browser SpeechRecognition is unreliable in iPhone home-screen apps.
 */

export interface ScribeHandle {
  stop: () => void;
}

interface Options {
  /** Live mic level 0–1, for the waveform. */
  onLevel?: (level: number) => void;
  onPartial?: (text: string) => void;
  onCommitted?: (text: string) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}

export const VOICE_UNAVAILABLE =
  "Voice isn't available right now (the free monthly minutes may be used up). Type instead.";

function toPcm16Base64(input: Float32Array, inRate: number): string {
  const ratio = inRate / 16000;
  const length = Math.floor(input.length / ratio);
  const bytes = new Uint8Array(length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] || 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function startScribe(opts: Options): Promise<ScribeHandle> {
  // Create the audio context inside the tap, before any await (iOS requirement).
  const AudioCtx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();

  let stream: MediaStream;
  let token: string;
  try {
    const [res, mic] = await Promise.all([
      fetch("/api/voice/token", { method: "POST" }),
      navigator.mediaDevices.getUserMedia({ audio: true }),
    ]);
    stream = mic;
    const data = (await res.json().catch(() => ({}))) as { token?: string };
    if (!res.ok || !data.token) {
      mic.getTracks().forEach((t) => t.stop());
      throw new Error(VOICE_UNAVAILABLE);
    }
    token = data.token;
  } catch (err) {
    void audioCtx.close();
    const denied = err instanceof DOMException && err.name === "NotAllowedError";
    throw new Error(denied ? "Allow microphone access for Tare in Settings to use voice." : (err as Error).message || VOICE_UNAVAILABLE);
  }

  const ws = new WebSocket(
    `wss://api.elevenlabs.io/v1/speech-to-text/realtime?token=${encodeURIComponent(token)}&model_id=scribe_v2_realtime&language_code=en`,
  );

  let stopped = false;
  let gotText = false;
  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  const mute = audioCtx.createGain();
  mute.gain.value = 0;

  const cleanup = () => {
    try {
      processor.disconnect();
      source.disconnect();
      mute.disconnect();
    } catch {}
    void audioCtx.close().catch(() => {});
    stream.getTracks().forEach((t) => t.stop());
    opts.onLevel?.(0);
  };

  ws.onopen = () => {
    void audioCtx.resume();
    source.connect(processor);
    processor.connect(mute);
    mute.connect(audioCtx.destination);
    processor.onaudioprocess = (e) => {
      if (stopped || ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      opts.onLevel?.(Math.min(1, Math.sqrt(sum / input.length) * 6));
      ws.send(
        JSON.stringify({
          message_type: "input_audio_chunk",
          audio_base_64: toPcm16Base64(input, audioCtx.sampleRate),
          sample_rate: 16000,
        }),
      );
    };
  };

  ws.onmessage = (event) => {
    let msg: { message_type?: string; text?: string };
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.message_type === "partial_transcript") opts.onPartial?.(msg.text ?? "");
    else if (msg.message_type === "committed_transcript") {
      gotText = true;
      opts.onCommitted?.(msg.text ?? "");
    } else if (msg.message_type && /error|quota|limit/i.test(msg.message_type)) {
      opts.onError?.(VOICE_UNAVAILABLE);
    }
  };

  ws.onerror = () => {
    if (!gotText) opts.onError?.(VOICE_UNAVAILABLE);
  };
  ws.onclose = () => {
    cleanup();
    opts.onClose?.();
  };

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: "", commit: true }));
        }
      } catch {}
      // Give the server a moment to send the final committed text.
      setTimeout(() => {
        try {
          ws.close();
        } catch {}
      }, 600);
    },
  };
}
