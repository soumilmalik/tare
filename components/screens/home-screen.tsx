"use client";

import { Camera, MessageSquareText, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppNav } from "@/components/app-context";
import { ActivityRings } from "@/components/home/activity-rings";
import { CreatineButton } from "@/components/home/creatine-button";
import { ManualEntry } from "@/components/home/manual-entry";
import { MealList } from "@/components/home/meal-list";
import { WaterControl } from "@/components/home/water-control";
import { useLogFlow } from "@/components/log/log-flow";
import { Snackbar } from "@/components/ui/snackbar";
import { DEFAULT_TZ, formatLongDate } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { Screen } from "./screen";

const UNDO_MS = 5000;

/** Pulling down at the top of Home opens search (SPEC §10). */
function usePullToSearch(ref: React.RefObject<HTMLElement | null>, onPull: () => void) {
  useEffect(() => {
    const el = ref.current;
    const scroller = el?.closest("section");
    if (!el || !scroller) return;
    let startY: number | null = null;
    const start = (e: TouchEvent) => {
      startY = scroller.scrollTop <= 0 ? e.touches[0].clientY : null;
    };
    const end = (e: TouchEvent) => {
      if (startY != null && e.changedTouches[0].clientY - startY > 90) onPull();
      startY = null;
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", end);
    };
  }, [ref, onPull]);
}

export function HomeScreen() {
  const store = useStore();
  const { openSearch } = useAppNav();
  const flow = useLogFlow();
  const root = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  usePullToSearch(root, openSearch);

  const p = store.profile;
  const tz = p?.timezone ?? DEFAULT_TZ;

  function remove(id: string) {
    // Finish any earlier pending delete first.
    if (timer.current && pending) {
      clearTimeout(timer.current);
      store.hardDeleteMeal(pending);
    }
    store.softDeleteMeal(id);
    setPending(id);
    timer.current = setTimeout(() => {
      store.hardDeleteMeal(id);
      setPending(null);
    }, UNDO_MS);
  }

  function undo() {
    if (!pending) return;
    if (timer.current) clearTimeout(timer.current);
    store.undoDeleteMeal(pending);
    setPending(null);
  }

  return (
    <div ref={root} className="flex min-h-full flex-col">
      <Screen title="Today" subtitle={store.today ? formatLongDate(store.today) : null}>
        {!store.online && <p className="mt-2 text-xs text-text-3">Offline — changes will sync when you reconnect.</p>}

        <div className="relative mt-6">
          <ActivityRings
            rings={[
              { label: "Protein", current: store.totals.protein, target: p?.target_protein_g ?? 100, unit: "g", shade: "#ffffff" },
              { label: "Calories", current: store.totals.kcal, target: p?.target_kcal ?? 2000, unit: "kcal", shade: "#bdbdbd" },
              { label: "Water", current: store.totals.water, target: p?.target_water_ml ?? 2000, unit: "ml", shade: "#737373" },
            ]}
          />
          {p?.takes_creatine && (
            <div className="absolute top-0 right-0">
              <CreatineButton />
            </div>
          )}
        </div>

        <div className="mt-8">
          <WaterControl />
        </div>

        <div className="mt-8">
          <ManualEntry />
        </div>

        <h2 className="mt-8 mb-3 text-sm text-text-2">Today&apos;s meals</h2>
        <MealList meals={store.meals} timeZone={tz} onDelete={remove} />
      </Screen>

      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-bg via-bg to-transparent px-5 pt-6 pb-3">
        <div className="mx-auto flex max-w-md items-center justify-center gap-8">
          <button
            type="button"
            onClick={flow.openVoice}
            aria-label="Log by voice"
            className="flex size-12 items-center justify-center rounded-full border border-line bg-surface text-text-1"
          >
            <Mic className="size-5" />
          </button>
          <button
            type="button"
            onClick={flow.pickPhotos}
            aria-label="Log with a photo or screenshot"
            className="flex size-16 items-center justify-center rounded-full bg-text-1 text-bg active:opacity-80"
          >
            <Camera className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => flow.openChat()}
            aria-label="Log by typing"
            className="flex size-12 items-center justify-center rounded-full border border-line bg-surface text-text-1"
          >
            <MessageSquareText className="size-5" />
          </button>
        </div>
      </div>

      <Snackbar message={pending ? "Meal deleted" : null} actionLabel="Undo" onAction={undo} />
    </div>
  );
}
