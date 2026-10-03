"use client";

import { useState } from "react";
import { primaryButton, secondaryButton } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const LOW_WATER_ML = 1500;

function ScoopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className} aria-hidden>
      <path d="M4 10h10v2a5 5 0 0 1-10 0z" />
      <path d="M14 11l6-4" />
      <path d="M7 7.5c1-.8 2-.8 3 0" />
    </svg>
  );
}

/** One tap logs 3 g creatine + 250 ml water, once per day (SPEC §7.2). */
export function CreatineButton() {
  const { creatine, setCreatine, totals } = useStore();
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [lowWater, setLowWater] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={creatine ? "Creatine logged today. Tap to undo." : "Log 3 g creatine with a glass of water"}
        aria-pressed={creatine}
        onClick={() => {
          if (creatine) return setConfirmUndo(true);
          setCreatine(true);
          if (totals.water + 250 < LOW_WATER_ML) setLowWater(true);
        }}
        className={cn(
          "flex size-11 items-center justify-center rounded-full border transition-colors duration-200",
          creatine ? "border-text-1 bg-text-1 text-bg" : "border-text-1 bg-bg text-text-1",
        )}
      >
        <ScoopIcon className="size-5" />
      </button>

      <Sheet open={confirmUndo} onClose={() => setConfirmUndo(false)} title="Undo creatine?">
        <p className="mb-5 text-sm text-text-2">This also removes the glass of water logged with it.</p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={secondaryButton} onClick={() => setConfirmUndo(false)}>
            Keep
          </button>
          <button
            type="button"
            className={primaryButton}
            onClick={() => {
              setCreatine(false);
              setConfirmUndo(false);
            }}
          >
            Undo
          </button>
        </div>
      </Sheet>

      <Sheet open={lowWater} onClose={() => setLowWater(false)}>
        <p className="mb-5 text-base font-medium">Extremely low water intake — complete your water intake ASAP.</p>
        <button type="button" className={primaryButton} onClick={() => setLowWater(false)}>
          OK
        </button>
      </Sheet>
    </>
  );
}
