"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { useDictation } from "@/lib/use-dictation";
import { cn } from "@/lib/utils";

/**
 * Mic button that dictates straight into a text field: the live words appear
 * in the field itself as you speak, added after whatever was already there.
 */
export function DictateButton({
  value,
  onChange,
  joiner = " ",
  className,
}: {
  value: string;
  onChange: (text: string) => void;
  /** How dictated text is joined to existing text (" " or "\n"). */
  joiner?: string;
  className?: string;
}) {
  const d = useDictation();
  const base = useRef<string | null>(null);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  // Stream the transcript into the field while a dictation is in progress.
  useEffect(() => {
    if (base.current == null) return;
    const before = base.current.trimEnd();
    latest.current(d.text ? (before ? `${before}${joiner}${d.text}` : d.text) : base.current);
  }, [d.text, joiner]);

  // Dictation finished: stop following the transcript.
  useEffect(() => {
    if (!d.listening && !d.starting) base.current = null;
  }, [d.listening, d.starting]);

  return (
    <div className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => {
          if (d.listening) return d.stop();
          base.current = value;
          void d.start();
        }}
        disabled={d.starting}
        aria-label={d.listening ? "Stop dictation" : "Dictate"}
        aria-pressed={d.listening}
        className={cn(
          "flex size-11 items-center justify-center rounded-full border transition-colors",
          d.listening ? "animate-pulse border-text-1 bg-text-1 text-bg" : "border-line bg-surface-2 text-text-1",
        )}
      >
        {d.listening ? <Square className="size-4" fill="currentColor" /> : <Mic className="size-4" />}
      </button>
      {d.error && (
        <p role="alert" className="absolute top-full right-0 z-10 mt-1 w-56 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-text-2">
          {d.error}
        </p>
      )}
    </div>
  );
}
