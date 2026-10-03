"use client";

/**
 * Bottom tab bar with a sliding indicator and sliding screens.
 * Adapted from Smooth Tab by @dorianbaffier (kokonutui.com, MIT):
 * 3 equal columns, full width, monochrome, and full-height screens that stay
 * mounted once visited (so scroll position and typed input survive tab switches).
 * Only transform/opacity are animated.
 */

import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  title: string;
  icon: LucideIcon;
  content: React.ReactNode;
}

interface SmoothTabProps {
  items: TabItem[];
  selected: string;
  onSelect: (tabId: string) => void;
}

const spring = { type: "spring", stiffness: 400, damping: 36 } as const;
const slide = { duration: 0.28, ease: [0.32, 0.72, 0, 1] } as const;

export default function SmoothTab({ items, selected, onSelect }: SmoothTabProps) {
  const [visited, setVisited] = React.useState(() => new Set([selected]));
  if (!visited.has(selected)) setVisited(new Set(visited).add(selected));
  const tabRefs = React.useRef(new Map<string, HTMLButtonElement>());

  const index = Math.max(
    0,
    items.findIndex((item) => item.id === selected),
  );

  const select = (tabId: string) => {
    if (tabId !== selected) onSelect(tabId);
  };

  // Arrow-key navigation, only while focus is on a tab (never hijacks inputs).
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = items[(index + step + items.length) % items.length];
    select(next.id);
    tabRefs.current.get(next.id)?.focus();
  };

  // app-frame: pinned to the screen edges (see globals.css).
  return (
    <div className="app-frame flex flex-col overflow-hidden bg-bg">
      {/* Screens: one track, translated by whole screen widths */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <motion.div
          className="flex h-full will-change-transform"
          initial={false}
          animate={{ x: `${-index * 100}%` }}
          transition={slide}
        >
          {items.map((item) => {
            const isSelected = item.id === selected;
            return (
              <section
                key={item.id}
                id={`panel-${item.id}`}
                role="tabpanel"
                aria-labelledby={`tab-${item.id}`}
                inert={!isSelected}
                className="pt-safe h-full w-full shrink-0 overflow-y-auto overscroll-contain"
              >
                {visited.has(item.id) ? item.content : null}
              </section>
            );
          })}
        </motion.div>
      </div>

      {/* Bottom toolbar */}
      <nav className="pb-safe shrink-0 border-t border-line bg-bg">
        <div role="tablist" aria-label="Main" className="relative grid grid-cols-3 p-1.5">
          <div aria-hidden className="pointer-events-none absolute inset-1.5">
            <motion.div
              className="h-full w-1/3 rounded-xl bg-surface-2"
              initial={false}
              animate={{ x: `${index * 100}%` }}
              transition={spring}
            />
          </div>

          {items.map((item) => {
            const isSelected = item.id === selected;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                ref={(el) => {
                  if (el) tabRefs.current.set(item.id, el);
                  else tabRefs.current.delete(item.id);
                }}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`panel-${item.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => select(item.id)}
                onKeyDown={handleKeyDown}
                className={cn(
                  "relative z-10 flex h-14 flex-col items-center justify-center gap-1 rounded-xl",
                  "text-[11px] font-medium transition-colors duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-3",
                  isSelected ? "text-text-1" : "text-text-3",
                )}
              >
                <Icon aria-hidden className="size-5" strokeWidth={isSelected ? 2 : 1.75} />
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
