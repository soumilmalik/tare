"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAppNav } from "@/components/app-context";
import { DictateButton } from "@/components/dictate-button";
import { useLogFlow } from "@/components/log/log-flow";
import { CardFlip } from "@/components/meals/card-flip";
import { PantryEditor } from "@/components/pantry-editor";
import { inputClass, secondaryButton } from "@/components/ui/fields";
import { postJson } from "@/lib/api";
import { DEFAULT_TZ } from "@/lib/dates";
import { draftTotals, useStore } from "@/lib/store";
import type { MealItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Screen } from "./screen";

type Hunger = "a bit" | "moderate" | "very";
type Slot = "breakfast" | "lunch" | "evening snack" | "dinner" | "late snack";

interface Suggestion {
  name: string;
  why: string;
  ingredients: string[];
  steps: string[];
  items: MealItem[];
}

function slotFor(hour: number): { slot: Slot; label: string } {
  if (hour >= 4 && hour < 11) return { slot: "breakfast", label: "Morning · breakfast next" };
  if (hour >= 11 && hour < 15) return { slot: "lunch", label: "Afternoon · lunch next" };
  if (hour >= 15 && hour < 18) return { slot: "evening snack", label: "Evening · snack next" };
  if (hour >= 18 && hour < 22) return { slot: "dinner", label: "Evening · dinner next" };
  return { slot: "late snack", label: "Late night · something light" };
}

function localHour(timeZone: string) {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(new Date()));
}

interface Cached {
  key: string;
  suggestions: Suggestion[];
}

export function AiMealsScreen() {
  const store = useStore();
  const { tab } = useAppNav();
  const flow = useLogFlow();
  const p = store.profile;
  const tz = p?.timezone ?? DEFAULT_TZ;

  const left = {
    kcal: Math.max(0, (p?.target_kcal ?? 2000) - store.totals.kcal),
    protein: Math.max(0, Math.round((p?.target_protein_g ?? 100) - store.totals.protein)),
  };
  const [hourNow] = useState(() => localHour(tz));
  const { slot, label } = slotFor(hourNow);

  const [hunger, setHunger] = useState<Hunger | null>(null);
  const [note, setNote] = useState("");
  const [request, setRequest] = useState<{ hunger: Hunger | null; note: string }>({ hunger: null, note: "" });
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  // Suggestions are cached until something they depend on changes (SPEC §8):
  // a new log, a pantry edit, or a hunger request. Reopening the tab reuses them.
  const key = useMemo(
    () =>
      [
        store.today,
        slot,
        store.totals.kcal,
        store.totals.protein,
        store.pantry.map((x) => x.ingredient).join(","),
        request.hunger,
        request.note,
      ].join("|"),
    [store.today, slot, store.totals.kcal, store.totals.protein, store.pantry, request],
  );
  const cacheKey = `tare.suggest.${store.userId}`;
  const [cache, setCache] = useState<Cached | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(cacheKey) ?? "null");
    } catch {
      return null;
    }
  });
  const current = cache?.key === key ? cache.suggestions : null;
  const loading = loadingKey === key;
  const shouldFetch =
    tab === "ai-meals" && !current && !loading && error?.key !== key && store.ready && !!p && store.online;

  useEffect(() => {
    if (!shouldFetch) return;
    const requestKey = key;
    // Marks this key as in flight; the fetch below resolves it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingKey(requestKey);
    postJson<{ suggestions: Suggestion[] }>("/api/ai/suggest", {
      slot,
      remaining: left,
      hunger: request.hunger,
      note: request.note,
    })
      .then((res) => {
        const next = { key: requestKey, suggestions: res.suggestions };
        setCache(next);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(next));
        } catch {}
      })
      .catch((err) => setError({ key: requestKey, message: (err as Error).message }))
      .finally(() => setLoadingKey((k) => (k === requestKey ? null : k)));
    // `left`, `slot` and `request` are all captured in `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFetch, key]);

  return (
    <Screen
      title="AI Meals"
      subtitle={
        <span className="tabular-nums">
          {left.kcal.toLocaleString("en-IN")} kcal · {left.protein} g protein left
        </span>
      }
    >
      <p className="mt-1 text-xs text-text-3">{label}</p>

      <section className="mt-6 space-y-3" aria-busy={loading}>
        {!store.online && !current && <p className="text-sm text-text-3">Suggestions need internet.</p>}
        {loading && !current && (
          <div className="space-y-3" aria-label="Loading suggestions">
            {[0, 1].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl border border-line bg-surface" />
            ))}
          </div>
        )}
        {error?.key === key && !current && (
          <div className="space-y-3">
            <p className="text-sm text-text-2">{error.message}</p>
            <button type="button" className={secondaryButton} onClick={() => setError(null)}>
              Try again
            </button>
          </div>
        )}
        {current?.map((s) => {
          const t = draftTotals(s.items);
          return (
            <CardFlip
              key={s.name}
              s={{ ...s, kcal: t.kcal, protein: t.protein }}
              onLog={() => flow.openDraft({ title: s.name, items: s.items, source: "text" })}
            />
          );
        })}
        {current && (
          <button
            type="button"
            onClick={() => {
              setCache(null);
              setError(null);
            }}
            className="flex min-h-11 items-center gap-2 text-sm text-text-2"
          >
            <RefreshCw className="size-4" /> Different options
          </button>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm text-text-2">How hungry are you?</h2>
        <div className="grid grid-cols-3 gap-2">
          {(["a bit", "moderate", "very"] as const).map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={hunger === h}
              onClick={() => setHunger(hunger === h ? null : h)}
              className={cn(
                "min-h-11 rounded-full border text-sm",
                hunger === h ? "border-text-1 bg-text-1 text-bg" : "border-line text-text-1",
              )}
            >
              {h === "a bit" ? "A bit" : h === "moderate" ? "Moderate" : "Very hungry"}
            </button>
          ))}
        </div>
        <div className="flex items-start gap-2">
          <input
            className={`${inputClass} h-11`}
            placeholder="Optional, e.g. craving something sweet"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DictateButton onText={(t) => setNote((n) => `${n} ${t}`.trim())} />
        </div>
        <button
          type="button"
          className={secondaryButton}
          disabled={!hunger && !note.trim()}
          onClick={() => {
            setError(null);
            setRequest({ hunger, note: note.trim() });
          }}
        >
          Get options
        </button>
      </section>

      <section id="pantry" className="mt-8 space-y-3">
        <h2 className="text-sm text-text-2">At home</h2>
        <PantryEditor />
      </section>
    </Screen>
  );
}
