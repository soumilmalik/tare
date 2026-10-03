"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { DictateButton } from "@/components/dictate-button";
import { useLogFlow } from "@/components/log/log-flow";
import { CardFlip } from "@/components/meals/card-flip";
import { PantryEditor } from "@/components/pantry-editor";
import { inputClass, secondaryButton } from "@/components/ui/fields";
import { Thinking } from "@/components/ui/thinking";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggestions are made only when asked (each one is an AI call), then kept
  // for this meal slot today, so reopening the tab costs nothing.
  const slotKey = `${store.today}|${slot}`;
  const cacheKey = `tare.suggest.${store.userId}`;
  const [cache, setCache] = useState<Cached | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(cacheKey) ?? "null");
    } catch {
      return null;
    }
  });
  const current = cache?.key === slotKey ? cache.suggestions : null;

  async function suggest(request: { hunger: Hunger | null; note: string }) {
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<{ suggestions: Suggestion[] }>("/api/ai/suggest", { slot, remaining: left, ...request });
      const next = { key: slotKey, suggestions: res.suggestions };
      setCache(next);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {}
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

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
        {loading ? (
          <Thinking className="py-4" label="Finding meal ideas" />
        ) : (
          !current && (
            <button
              type="button"
              className={secondaryButton}
              disabled={!store.online}
              onClick={() => suggest({ hunger: null, note: "" })}
            >
              {store.online ? "Suggest my next meal" : "Suggestions need internet"}
            </button>
          )
        )}
        {error && <p className="text-sm text-text-2">{error}</p>}
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
        {current && !loading && (
          <button
            type="button"
            disabled={!store.online}
            onClick={() => suggest({ hunger, note: note.trim() })}
            className="flex min-h-11 items-center gap-2 text-sm text-text-2 disabled:opacity-40"
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
          <textarea
            rows={2}
            className={`${inputClass} h-auto min-h-11 flex-1 resize-none py-2.5 [field-sizing:content]`}
            placeholder="Optional, e.g. I have eggs and bread, want something quick"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DictateButton value={note} onChange={setNote} />
        </div>
        <button
          type="button"
          className={secondaryButton}
          disabled={(!hunger && !note.trim()) || loading || !store.online}
          onClick={() => suggest({ hunger, note: note.trim() })}
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
