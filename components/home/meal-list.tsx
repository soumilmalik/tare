"use client";

/**
 * Today's meals. Adapted from AnimatedList (reactbits): structured rows,
 * stable keys (meal id), no window-level arrow/Tab handler (it broke inputs),
 * no hover selection, plus swipe-left to delete. Monochrome.
 */

import { AnimatePresence, motion } from "motion/react";
import { useLogFlow } from "@/components/log/log-flow";
import type { MealLog } from "@/lib/types";

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

export function MealList({
  meals,
  timeZone,
  onDelete,
}: {
  meals: MealLog[];
  timeZone: string;
  onDelete: (id: string) => void;
}) {
  const { editMeal } = useLogFlow();

  if (meals.length === 0) {
    return <p className="py-8 text-center text-sm text-text-3">Nothing logged yet</p>;
  }

  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {[...meals].reverse().map((meal) => (
          <motion.li
            key={meal.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative overflow-hidden rounded-xl"
          >
            <div className="absolute inset-0 flex items-center justify-end bg-surface-2 pr-5 text-sm text-text-2" aria-hidden>
              Delete
            </div>
            <motion.button
              type="button"
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: -120, right: 0 }}
              dragElastic={{ left: 0.2, right: 0 }}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) onDelete(meal.id);
              }}
              onTap={() => editMeal(meal)}
              aria-label={`${meal.title}, ${meal.total_kcal} kcal, ${meal.total_protein} g protein. Tap to edit.`}
              className="relative flex w-full items-center justify-between gap-3 border border-line bg-surface px-4 py-3 text-left"
              style={{ borderRadius: 12, touchAction: "pan-y" }}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-text-1">{meal.title}</span>
                <span className="block text-xs text-text-3">{formatTime(meal.logged_at, timeZone)}</span>
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums">
                {Math.round(meal.total_kcal)} kcal
                <span className="block text-xs text-text-2">{Number(meal.total_protein)} g</span>
              </span>
            </motion.button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
