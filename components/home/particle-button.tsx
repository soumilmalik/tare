"use client";

/**
 * Adapted from Particle Button by @dorianbaffier (kokonutui.com, MIT).
 * Fixes: the click now actually runs onClick; particles are white and
 * positioned relative to the button (fixed positioning breaks inside the
 * sliding tab track); no pointer icon.
 */

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Particle {
  id: number;
  dx: number;
  dy: number;
  delay: number;
}

export function ParticleButton({
  onClick,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextId = useRef(0);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(e);
    const burst = Array.from({ length: 8 }, (_, i) => ({
      id: nextId.current++,
      dx: (i % 2 ? 1 : -1) * (20 + Math.random() * 40),
      dy: -(25 + Math.random() * 45),
      delay: i * 0.03,
    }));
    setParticles((p) => [...p, ...burst]);
    setTimeout(() => setParticles((p) => p.filter((x) => !burst.includes(x))), 900);
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 size-1.5 rounded-full bg-text-1"
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{ scale: [0, 1, 0], x: p.dx, y: p.dy }}
            transition={{ duration: 0.6, delay: p.delay, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        transition={{ duration: 0.1 }}
        onClick={handleClick}
        className={cn("relative", className)}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {children}
      </motion.button>
    </div>
  );
}
