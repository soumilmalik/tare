"use client";

/**
 * Adapted from Card Flip by @dorianbaffier (kokonutui.com, MIT): flips on tap
 * (not hover), monochrome (no orange), content from a suggestion, and
 * "Log this" instead of "Start today". The card is as tall as the side being
 * shown, so the front has no empty space.
 */

import { ArrowRight, Repeat2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
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
  const front = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState({ front: 0, back: 0 });

  // Both faces are stacked absolutely for the 3D flip, so measure them.
  useLayoutEffect(() => {
    const measure = () =>
      setHeights({ front: front.current?.scrollHeight ?? 0, back: back.current?.scrollHeight ?? 0 });
    measure();
    const observer = new ResizeObserver(measure);
    if (front.current) observer.observe(front.current);
    if (back.current) observer.observe(back.current);
    return () => observer.disconnect();
  }, []);

  const height = flipped ? heights.back : heights.front;

  return (
    <div
      className="relative w-full transition-[height] duration-500 ease-[cubic-bezier(0.77,0,0.175,1)] [perspective:2000px] motion-reduce:transition-none"
      style={{ height: height || undefined }}
    >
      <div
        className={cn(
          "relative h-full w-full [transform-style:preserve-3d]",
          "transition-transform duration-500 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none",
          flipped ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]",
        )}
      >
        {/* Front */}
        <button
          ref={front}
          type="button"
          onClick={() => setFlipped(true)}
          aria-label={`${s.name}, ${s.kcal} kcal, ${s.protein} g protein. Tap for recipe.`}
          aria-hidden={flipped}
          tabIndex={flipped ? -1 : 0}
          className="absolute inset-x-0 top-0 block w-full space-y-1.5 rounded-2xl border border-line bg-surface p-4 text-left [backface-visibility:hidden]"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="text-base leading-snug font-semibold">{s.name}</span>
            <Repeat2 className="mt-0.5 size-4 shrink-0 text-text-3" aria-hidden />
          </span>
          <span className="block text-sm text-text-2 tabular-nums">
            {s.kcal} kcal · {s.protein} g protein
          </span>
          <span className="block text-sm text-text-3">{s.why}</span>
        </button>

        {/* Back */}
        <div
          ref={back}
          aria-hidden={!flipped}
          className="absolute inset-x-0 top-0 space-y-3 rounded-2xl border border-line bg-surface p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <button
            type="button"
            tabIndex={flipped ? 0 : -1}
            onClick={() => setFlipped(false)}
            className="flex w-full items-start justify-between gap-3 text-left"
            aria-label="Flip back"
          >
            <span className="font-semibold leading-snug">{s.name}</span>
            <Repeat2 className="mt-0.5 size-4 shrink-0 text-text-3" aria-hidden />
          </button>
          <ul className="space-y-1 text-sm text-text-2">
            {s.ingredients.map((i) => (
              <li key={i}>· {i}</li>
            ))}
          </ul>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-text-2">
            {s.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <button
            type="button"
            tabIndex={flipped ? 0 : -1}
            onClick={onLog}
            className="flex h-11 w-full items-center justify-between rounded-xl bg-surface-2 px-4 text-sm font-medium"
          >
            Log this <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
