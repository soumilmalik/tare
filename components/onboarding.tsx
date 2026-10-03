"use client";

import { ChevronLeft, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { DictateButton } from "@/components/dictate-button";
import {
  BasicsFields,
  BodyFields,
  DietFields,
  draftFromProfile,
  type ProfileDraft,
  TrainingFields,
  validate,
} from "@/components/profile-fields";
import { Choice, Field, inputClass, primaryButton, secondaryButton } from "@/components/ui/fields";
import { NumberInput } from "@/components/ui/number-input";
import { enablePush, pushSupport } from "@/lib/push";
import { useStore } from "@/lib/store";
import { calculateTargets, targetInputFromProfile } from "@/lib/targets";
import type { DietType, MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = [
  "basics",
  "body",
  "training",
  "diet",
  "meals",
  "pantry",
  "creatine",
  "notifications",
  "targets",
] as const;
type Step = (typeof STEPS)[number];

const TITLES: Record<Step, string> = {
  basics: "About you",
  body: "Body and goal",
  training: "Training",
  diet: "Diet",
  meals: "What you usually eat",
  pantry: "Usually at home",
  creatine: "Creatine",
  notifications: "Reminders",
  targets: "Your targets",
};

type Meals = Record<"breakfast" | "lunch" | "dinner" | "snack" | "regular", string>;

interface Saved {
  step: number;
  draft: ProfileDraft;
  meals: Meals;
  pantry: string[];
  creatine: boolean | null;
}

const STORAGE = "tare.onboarding";
const EMPTY_MEALS: Meals = { breakfast: "", lunch: "", dinner: "", snack: "", regular: "" };

function pantrySuggestions(diet: DietType | null) {
  const veg = [
    "Paneer", "Curd", "Milk", "Moong dal", "Toor dal", "Rajma", "Chana", "Soya chunks",
    "Rice", "Atta", "Oats", "Poha", "Besan", "Bread", "Peanut butter", "Bananas",
    "Onion", "Tomato", "Potato", "Spinach", "Tofu", "Sprouts", "Ghee", "Almonds", "Whey protein",
  ];
  if (diet === "egg") return ["Eggs", ...veg];
  if (diet === "non-veg") return ["Eggs", "Chicken", "Fish", ...veg];
  return veg;
}

export function Onboarding() {
  const store = useStore();
  const [saved, setSaved] = useState<Saved>(() => {
    const base: Saved = {
      step: 0,
      draft: draftFromProfile(store.profile),
      meals: EMPTY_MEALS,
      pantry: [],
      creatine: null,
    };
    try {
      const raw = localStorage.getItem(STORAGE);
      return raw ? { ...base, ...JSON.parse(raw) } : base;
    } catch {
      return base;
    }
  });
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [targets, setTargets] = useState<{ kcal: number | null; protein: number | null; water: number | null }>({
    kcal: null,
    protein: null,
    water: null,
  });
  const [customPantry, setCustomPantry] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(saved));
    } catch {}
  }, [saved]);

  const step = STEPS[saved.step];
  const { draft } = saved;
  const update = (patch: Partial<Saved>) => setSaved((s) => ({ ...s, ...patch }));
  const updateDraft = (patch: Partial<ProfileDraft>) => update({ draft: { ...draft, ...patch } });

  const calculated = useMemo(() => {
    const input = targetInputFromProfile(draft);
    return input ? calculateTargets(input) : null;
  }, [draft]);

  function go(delta: 1 | -1) {
    if (delta === 1) {
      const problem =
        step === "basics" || step === "body" || step === "training" || step === "diet"
          ? validate(step, draft)
          : step === "creatine" && saved.creatine == null
            ? "Choose yes or no."
            : null;
      if (problem) return setError(problem);
    }
    setError(null);
    setDirection(delta);
    update({ step: Math.min(STEPS.length - 1, Math.max(0, saved.step + delta)) });
  }

  async function finish() {
    if (!calculated) return;
    const kcal = targets.kcal ?? calculated.kcal;
    const protein = targets.protein ?? calculated.proteinG;
    const water = targets.water ?? calculated.waterMl;
    if (kcal < 800 || kcal > 6000) return setError("Calories should be between 800 and 6000.");
    if (protein < 20 || protein > 400) return setError("Protein should be between 20 and 400 g.");
    if (water < 500 || water > 8000) return setError("Water should be between 500 and 8000 ml.");

    setBusy(true);
    setError(null);
    const foods = (Object.entries(saved.meals) as [MealSlot, string][]).flatMap(([slot, text]) =>
      (slot === "regular" ? text.split(/[\n,]/) : [text])
        .map((t) => t.trim())
        .filter(Boolean)
        .map((description) => ({ meal_slot: slot, description, typical_kcal: null, typical_protein: null })),
    );
    const foodsError = await store.setRegularFoods(foods);
    const profileError =
      foodsError ??
      (await store.saveProfile({
        ...draft,
        name: draft.name?.trim() ?? null,
        allergies_or_avoid: draft.allergies_or_avoid?.trim() || null,
        takes_creatine: saved.creatine ?? false,
        target_kcal: kcal,
        target_protein_g: protein,
        target_water_ml: water,
        onboarded_at: new Date().toISOString(),
      }));
    if (profileError) {
      setBusy(false);
      return setError(`Couldn't save: ${profileError}. Check your connection and try again.`);
    }
    for (const item of saved.pantry) store.addPantry(item);
    try {
      localStorage.removeItem(STORAGE);
    } catch {}
  }

  return (
    <main className="pt-safe pb-safe flex h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-3 pt-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={saved.step === 0}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full text-text-1 disabled:opacity-0"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex gap-1.5" aria-label={`Step ${saved.step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                "size-1.5 rounded-full transition-colors duration-300",
                i === saved.step ? "bg-text-1" : i < saved.step ? "bg-text-2" : "bg-line",
              )}
            />
          ))}
        </div>
        <span className="size-11" />
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.section
            key={step}
            custom={direction}
            initial={{ x: direction * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -40, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute inset-0 overflow-y-auto overscroll-contain px-5 pt-6 pb-6"
          >
            <div className="mx-auto max-w-md">
              <h1 className="mb-6 text-2xl font-semibold tracking-tight">{TITLES[step]}</h1>

              {step === "basics" && <BasicsFields value={draft} onChange={updateDraft} />}
              {step === "body" && <BodyFields value={draft} onChange={updateDraft} />}
              {step === "training" && <TrainingFields value={draft} onChange={updateDraft} />}
              {step === "diet" && <DietFields value={draft} onChange={updateDraft} />}

              {step === "meals" && (
                <div className="space-y-5">
                  <p className="text-sm text-text-2">
                    A rough idea is enough. Tare uses this to make better estimates and suggestions.
                  </p>
                  {(
                    [
                      ["breakfast", "Breakfast", "2 eggs, toast, coffee"],
                      ["lunch", "Lunch", "2 rotis, dal, sabzi, salad"],
                      ["dinner", "Dinner", "Rice, rajma, curd"],
                      ["snack", "Snacks", "Fruit, chai, makhana"],
                      ["regular", "Other things you eat regularly", "Yoga Bar, bananas, peanut butter (one per line)"],
                    ] as const
                  ).map(([slot, label, placeholder]) => (
                    <Field key={slot} label={label}>
                      <div className="flex items-start gap-2">
                        <textarea
                          rows={2}
                          className={`${inputClass} h-auto flex-1 py-3`}
                          placeholder={placeholder}
                          value={saved.meals[slot]}
                          onChange={(e) => update({ meals: { ...saved.meals, [slot]: e.target.value } })}
                        />
                        <DictateButton
                          onText={(t) =>
                            setSaved((s) => ({
                              ...s,
                              meals: { ...s.meals, [slot]: `${s.meals[slot]} ${t}`.trim() },
                            }))
                          }
                        />
                      </div>
                    </Field>
                  ))}
                </div>
              )}

              {step === "pantry" && (
                <div className="space-y-5">
                  <p className="text-sm text-text-2">Tap what you usually have. Suggestions will use these first.</p>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set([...pantrySuggestions(draft.diet_type), ...saved.pantry])].map((item) => {
                      const on = saved.pantry.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            update({
                              pantry: on ? saved.pantry.filter((p) => p !== item) : [...saved.pantry, item],
                            })
                          }
                          className={cn(
                            "min-h-10 rounded-full border px-4 text-sm",
                            on ? "border-text-1 bg-text-1 text-bg" : "border-line text-text-1",
                          )}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = customPantry.trim();
                      if (v && !saved.pantry.includes(v)) update({ pantry: [...saved.pantry, v] });
                      setCustomPantry("");
                    }}
                  >
                    <input
                      className={inputClass}
                      placeholder="Add something else"
                      value={customPantry}
                      onChange={(e) => setCustomPantry(e.target.value)}
                    />
                    <button
                      type="submit"
                      aria-label="Add"
                      className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line"
                    >
                      <Plus className="size-5" />
                    </button>
                  </form>
                </div>
              )}

              {step === "creatine" && (
                <div className="space-y-4">
                  <p className="text-sm text-text-2">Do you take creatine?</p>
                  <Choice<string>
                    value={saved.creatine == null ? null : saved.creatine ? "yes" : "no"}
                    onChange={(v) => update({ creatine: v === "yes" })}
                    options={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                    ]}
                  />
                  <p className="text-xs text-text-3">
                    You&apos;ll get a one-tap button on Home that logs 3 g with a glass of water.
                  </p>
                </div>
              )}

              {step === "notifications" && (
                <div className="space-y-4">
                  <p className="text-sm text-text-2">
                    Tare can remind you in the evening if your water is low{saved.creatine ? ", and if you haven't had creatine" : ""}.
                  </p>
                  {pushSupport() === "install-first" ? (
                    <p className="text-sm text-text-3">
                      To get reminders, add Tare to your Home Screen (Share → Add to Home Screen) and turn them on
                      later in Profile.
                    </p>
                  ) : (
                    <button
                      type="button"
                      className={secondaryButton}
                      onClick={async () => setNotifyMsg((await enablePush()) ?? "Reminders are on.")}
                    >
                      Allow notifications
                    </button>
                  )}
                  {notifyMsg && <p className="text-sm text-text-2">{notifyMsg}</p>}
                </div>
              )}

              {step === "targets" && calculated && (
                <div className="space-y-5">
                  {calculated.timelineNote && (
                    <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-text-2">
                      {calculated.timelineNote}
                    </p>
                  )}
                  <Field label="Calories (kcal)" hint={calculated.explain.kcal}>
                    <NumberInput
                      value={targets.kcal ?? calculated.kcal}
                      onChange={(kcal) => setTargets((t) => ({ ...t, kcal }))}
                    />
                  </Field>
                  <Field label="Protein (g)" hint={calculated.explain.protein}>
                    <NumberInput
                      value={targets.protein ?? calculated.proteinG}
                      onChange={(protein) => setTargets((t) => ({ ...t, protein }))}
                    />
                  </Field>
                  <Field label="Water (ml)" hint={calculated.explain.water}>
                    <NumberInput
                      value={targets.water ?? calculated.waterMl}
                      onChange={(water) => setTargets((t) => ({ ...t, water }))}
                    />
                  </Field>
                  <p className="text-xs text-text-3">You can change these any time in Profile.</p>
                </div>
              )}
            </div>
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="mx-auto w-full max-w-md space-y-2 px-5 pb-4">
        <p role="alert" className="min-h-5 text-sm text-text-2">
          {error}
        </p>
        {step === "targets" ? (
          <button type="button" className={primaryButton} disabled={busy} onClick={finish}>
            {busy ? "Saving…" : "Looks good"}
          </button>
        ) : (
          <button type="button" className={primaryButton} onClick={() => go(1)}>
            {step === "notifications" ? (notifyMsg ? "Next" : "Skip for now") : "Next"}
          </button>
        )}
      </footer>
    </main>
  );
}
