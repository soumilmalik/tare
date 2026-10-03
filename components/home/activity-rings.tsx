"use client";

/**
 * Progress rings adapted from Apple Activity Card by @kokonutui (kokonutui.com, MIT):
 * real values as props, monochrome, header-sized, no fixed MOVE/EXERCISE/STAND.
 */

import { motion } from "motion/react";

export interface Ring {
  label: string;
  current: number;
  target: number;
  unit: string;
  /** Stroke colour; monochrome shades only. */
  shade: string;
}

const STROKE = 9;
const GAP = 3;

function RingArc({ ring, size }: { ring: Ring; size: number }) {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = ring.target > 0 ? Math.min(1, ring.current / ring.target) : 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute -rotate-90"
      style={{ top: "50%", left: "50%", marginTop: -size / 2, marginLeft: -size / 2 }}
      aria-hidden
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1f1f1f" strokeWidth={STROKE} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={ring.shade}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={false}
        animate={{ strokeDashoffset: circumference * (1 - pct), opacity: pct > 0 ? 1 : 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </svg>
  );
}

export function ActivityRings({ rings, size = 104 }: { rings: Ring[]; size?: number }) {
  return (
    <div className="flex items-center gap-5">
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        role="img"
        aria-label={rings.map((r) => `${r.label} ${Math.round(r.current)} of ${r.target} ${r.unit}`).join(", ")}
      >
        {rings.map((ring, i) => (
          <RingArc key={ring.label} ring={ring} size={size - i * 2 * (STROKE + GAP)} />
        ))}
      </div>
      <dl className="min-w-0 space-y-2">
        {rings.map((ring) => (
          <div key={ring.label}>
            <dt className="flex items-center gap-1.5 text-xs text-text-2">
              <span className="size-2 rounded-full" style={{ background: ring.shade }} aria-hidden />
              {ring.label}
            </dt>
            <dd className="text-base font-medium tabular-nums">
              {Math.round(ring.current).toLocaleString("en-IN")}
              <span className="text-text-3"> / {ring.target.toLocaleString("en-IN")} {ring.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
