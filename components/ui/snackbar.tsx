"use client";

import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";

/** Small message above the tab bar, with an optional action (e.g. Undo). */
export function Snackbar({
  message,
  actionLabel,
  onAction,
}: {
  message: string | null;
  actionLabel?: string;
  onAction?: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          className="fixed inset-x-4 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-text-1">{message}</span>
          {actionLabel && (
            <button type="button" onClick={onAction} className="min-h-9 px-2 font-medium text-text-1 underline underline-offset-4">
              {actionLabel}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
