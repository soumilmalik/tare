"use client";

import { useState } from "react";

export interface Point {
  label: string;
  value: number;
}

const W = 340;
const H = 150;
const PAD = { top: 12, right: 8, bottom: 20, left: 36 };

function niceMax(n: number) {
  if (n <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= n / 2) ?? 10;
  return Math.ceil(n / (step * pow)) * step * pow;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/**
 * Single-series column chart with a target line. Monochrome: white columns
 * on black, hairline grey axis, text in text colours. Tap a column to read it.
 */
export function BarChart({ points, target, unit, title }: { points: Point[]; target: number | null; unit: string; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(target ?? 0, ...points.map((p) => p.value)) * 1.05);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(24, slot - 2));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const shown = active != null ? points[active] : null;

  return (
    <figure className="space-y-1">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="text-text-2">{title}</span>
        <span className="tabular-nums text-text-1" aria-live="polite">
          {shown ? `${shown.label} · ${fmt(shown.value)} ${unit}` : target ? `Target ${fmt(target)} ${unit}` : ""}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}, ${points.length} days`}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#1f1f1f" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#525252">
              {t >= 1000 ? `${Math.round(t / 100) / 10}k` : fmt(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const top = y(p.value);
          const h = PAD.top + plotH - top;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={i} onClick={() => setActive(active === i ? null : i)} className="cursor-pointer">
              {/* Hit target taller and wider than the mark */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
                  fill={active == null || active === i ? "#e5e5e5" : "#525252"}
                />
              )}
            </g>
          );
        })}
        {target != null && target > 0 && (
          <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} stroke="#a3a3a3" strokeWidth={1} />
        )}
        {points.length > 0 && (
          <>
            <text x={PAD.left} y={H - 6} fontSize={9} fill="#525252">
              {points[0].label}
            </text>
            <text x={W - PAD.right} y={H - 6} fontSize={9} fill="#525252" textAnchor="end">
              {points[points.length - 1].label}
            </text>
          </>
        )}
      </svg>
    </figure>
  );
}

/** Weight trend: 2px line with end dot and end label. */
export function LineChart({ points, unit, title }: { points: Point[]; unit: string; title: string }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <figure className="space-y-1">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="text-text-2">{title}</span>
        <span className="tabular-nums text-text-1">
          {last.value} {unit}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}: from ${points[0].value} to ${last.value} ${unit}`}>
        {[lo, (lo + hi) / 2, hi].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#1f1f1f" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#525252">
              {Math.round(t * 10) / 10}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="#e5e5e5" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r={4} fill="#e5e5e5" stroke="#000" strokeWidth={2} />
        <text x={PAD.left} y={H - 6} fontSize={9} fill="#525252">
          {points[0].label}
        </text>
        <text x={W - PAD.right} y={H - 6} fontSize={9} fill="#525252" textAnchor="end">
          {last.label}
        </text>
      </svg>
    </figure>
  );
}
