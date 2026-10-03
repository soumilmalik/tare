"use client";

/**
 * Recording UI adapted from AI Voice by @kokonutui (kokonutui.com, MIT):
 * no demo mode, driven by the real recording, waveform from real mic levels,
 * monochrome, plus the live transcript.
 */

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const BARS = 40;

export function VoiceRecorder({
  listening,
  starting,
  level,
  text,
  error,
  onStart,
  onStop,
}: {
  listening: boolean;
  starting: boolean;
  level: number;
  text: string;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [history, setHistory] = useState<number[]>(() => Array(BARS).fill(0));
  const last = useRef(0);

  useEffect(() => {
    if (!listening) return;
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => {
      clearInterval(id);
      setSeconds(0);
    };
  }, [listening]);

  // Sample the mic level into a scrolling waveform (~12 times a second).
  useEffect(() => {
    if (!listening) return;
    const now = Date.now();
    if (now - last.current < 80) return;
    last.current = now;
    setHistory((h) => [...h.slice(1), level]);
  }, [level, listening]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <button
        type="button"
        onClick={listening ? onStop : onStart}
        disabled={starting}
        aria-label={listening ? "Stop recording" : "Start recording"}
        className={cn(
          "flex size-16 items-center justify-center rounded-full border transition-colors",
          listening ? "border-text-1 bg-text-1 text-bg" : "border-line bg-surface-2 text-text-1",
        )}
      >
        {listening ? <Square className="size-5" fill="currentColor" /> : <Mic className="size-6" />}
      </button>

      <span className={cn("font-mono text-sm", listening ? "text-text-1" : "text-text-3")}>
        {mm}:{ss}
      </span>

      <div className="flex h-8 w-64 items-center justify-center gap-[3px]" aria-hidden>
        {history.map((v, i) => (
          <div
            key={i}
            className={cn("w-[3px] rounded-full", listening ? "bg-text-2" : "bg-line")}
            style={{ height: `${Math.max(8, Math.min(100, v * 100))}%` }}
          />
        ))}
      </div>

      <p className="h-4 text-xs text-text-2" aria-live="polite">
        {starting ? "Starting…" : listening ? "Listening…" : "Tap to speak"}
      </p>

      {(text || error) && (
        <p className={cn("w-full rounded-xl bg-bg px-4 py-3 text-sm", error ? "text-text-2" : "text-text-1")}>
          {error ?? text}
        </p>
      )}
    </div>
  );
}
