"use client";

/**
 * Adapted from Card Flip by @dorianbaffier (kokonutui.com, MIT): flips on tap
 * (not hover), monochrome (no orange), content from a suggestion, and
 * "Log this" instead of "Start today".
 */

import { ArrowRight, Repeat2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface FlipSuggestion {
  name: string;
  why: string;
  kcal: number;
  protein: number;
  ingredients: string[];
  steps: string[];
}

export function CardFlip({ s, onLog }: { s: FlipSuggestion; onLog: () => void }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="relative h-80 w-full [perspective:2000px]">
      <div
        className={cn(
          "relative h-full w-full [transform-style:preserve-3d]",
          "transition-transform duration-500 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none",
          flipped ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]",
        )}
      >
        {/* Front */}
        <button
          type="button"
          onClick={() => setFlipped(true)}
          aria-label={`${s.name}. Tap for recipe.`}
          aria-hidden={flipped}
          tabIndex={flipped ? -1 : 0}
          className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 text-left [backface-visibility:hidden]"
        >
          <span className="flex items-center justify-between text-xs text-text-3">
            Suggestion <Repeat2 className="size-4" aria-hidden />
          </span>
          <span className="space-y-2">
            <span className="block text-lg leading-snug font-semibold">{s.name}</span>
            <span className="block text-sm text-text-2 tabular-nums">
              {s.kcal} kcal · {s.protein} g protein
            </span>
            <span className="block text-sm text-text-3">{s.why}</span>
          </span>
        </button>

        {/* Back */}
        <div
          aria-hidden={!flipped}
          className="absolute inset-0 flex flex-col rounded-2xl border border-line bg-surface p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <button
            type="button"
            tabIndex={flipped ? 0 : -1}
            onClick={() => setFlipped(false)}
            className="flex items-center justify-between text-left"
            aria-label="Flip back"
          >
            <span className="font-semibold">{s.name}</span>
            <Repeat2 className="size-4 text-text-3" aria-hidden />
          </button>
          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto text-sm">
            <ul className="space-y-1 text-text-2">
              {s.ingredients.map((i) => (
                <li key={i}>· {i}</li>
              ))}
            </ul>
            <ol className="list-decimal space-y-1 pl-4 text-text-2">
              {s.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            tabIndex={flipped ? 0 : -1}
            onClick={onLog}
            className="mt-3 flex h-11 items-center justify-between rounded-xl bg-surface-2 px-4 text-sm font-medium"
          >
            Log this <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
