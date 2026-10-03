"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { useDictation } from "@/lib/use-dictation";
import { cn } from "@/lib/utils";

/** Small mic button that dictates into a text field. Calls onText with the final text. */
export function DictateButton({ onText, className }: { onText: (text: string) => void; className?: string }) {
  const d = useDictation();
  const wasListening = useRef(false);

  useEffect(() => {
    if (wasListening.current && !d.listening && d.text) onText(d.text);
    wasListening.current = d.listening;
  }, [d.listening, d.text, onText]);

  return (
    <div className={cn("space-y-1", className)}>
      <button
        type="button"
        onClick={d.listening ? d.stop : d.start}
        disabled={d.starting}
        aria-label={d.listening ? "Stop dictation" : "Dictate"}
        className={cn(
          "flex size-11 items-center justify-center rounded-full border",
          d.listening ? "border-text-1 bg-text-1 text-bg" : "border-line bg-surface-2 text-text-1",
        )}
      >
        {d.listening ? <Square className="size-4" fill="currentColor" /> : <Mic className="size-4" />}
      </button>
      {(d.listening || d.error) && (
        <p className="text-xs text-text-2" aria-live="polite">
          {d.error ?? (d.text || "Listening…")}
        </p>
      )}
    </div>
  );
}
