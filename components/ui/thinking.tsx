"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const WORDS = [
  "Simmering",
  "Honing",
  "Tempering the tadka",
  "Kneading",
  "Discombobulating",
  "Marinating",
  "Weighing katoris",
  "Whisking",
  "Counting rotis",
  "Seasoning",
  "Reticulating macros",
  "Plating",
];

/** Rotating "Simmering…" line shown while the AI works (instead of blank boxes). */
export function Thinking({ className, label = "Working" }: { className?: string; label?: string }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * WORDS.length));
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % WORDS.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <span role="status" aria-label={label} className={cn("inline-flex items-center gap-2 text-sm text-text-2", className)}>
      <motion.span
        aria-hidden
        className="text-text-1"
        animate={{ opacity: [0.35, 1, 0.35], rotate: [0, 90, 180] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        ✻
      </motion.span>
      <span className="relative inline-flex overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={WORDS[i]}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {WORDS[i]}…
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
