"use client";

import { GlassWater, Minus } from "lucide-react";
import { ParticleButton } from "@/components/home/particle-button";
import { useStore } from "@/lib/store";

function haptic() {
  try {
    navigator.vibrate?.(10);
  } catch {}
}

/** Big +250 ml glass button with the (done/target) counter and a − (SPEC §7.3). */
export function WaterControl() {
  const { totals, profile, addWater } = useStore();
  const target = profile?.target_water_ml ?? 2000;
  const glasses = Math.floor(totals.water / 250);
  const goal = Math.round(target / 250);

  return (
    <div className="flex items-center justify-center gap-5">
      <ParticleButton
        aria-label="Add a glass of water (250 ml)"
        onClick={() => {
          haptic();
          addWater(250);
        }}
        className="flex size-24 flex-col items-center justify-center rounded-full border border-line bg-surface text-text-1"
      >
        <GlassWater className="size-8" strokeWidth={1.5} />
        <span className="mt-1 text-xs text-text-2">+250 ml</span>
      </ParticleButton>
      <div className="flex items-center gap-2">
        <span className="text-lg font-medium tabular-nums" aria-live="polite">
          ({glasses}/{goal})
        </span>
        <button
          type="button"
          aria-label="Remove a glass of water (250 ml)"
          disabled={totals.water <= 0}
          onClick={() => addWater(-250)}
          className="flex size-11 items-center justify-center rounded-full border border-line text-text-2 disabled:opacity-30"
        >
          <Minus className="size-4" />
        </button>
      </div>
    </div>
  );
}
