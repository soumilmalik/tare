"use client";

import { Check, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { NumberInput } from "@/components/ui/number-input";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** "Calories +" / "Protein +" pills with an inline number input (SPEC §7.4). */
export function ManualEntry() {
  const { addMeal } = useStore();
  const [open, setOpen] = useState<"kcal" | "protein" | null>(null);
  const [value, setValue] = useState<number | null>(null);

  function save() {
    if (!open || !value || value <= 0) return;
    addMeal(
      open === "kcal"
        ? { title: "Manual calories", source: "manual", items: [{ name: "Manual calories", qty: "", kcal: value, protein: 0 }] }
        : { title: "Manual protein", source: "manual", items: [{ name: "Manual protein", qty: "", kcal: 0, protein: value }] },
    );
    setOpen(null);
    setValue(null);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {(["kcal", "protein"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-expanded={open === kind}
            onClick={() => {
              setOpen(open === kind ? null : kind);
              setValue(null);
            }}
            className={cn(
              "flex h-11 items-center justify-center gap-1.5 rounded-full border text-sm transition-colors",
              open === kind ? "border-text-1 bg-text-1 text-bg" : "border-line text-text-1",
            )}
          >
            {kind === "kcal" ? "Calories" : "Protein"} <Plus className="size-4" />
          </button>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            key={open}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <NumberInput
              autoFocus
              decimal={open === "protein"}
              value={value}
              onChange={setValue}
              placeholder={open === "kcal" ? "kcal" : "grams of protein"}
              aria-label={open === "kcal" ? "Calories to add" : "Protein to add in grams"}
            />
            <button
              type="submit"
              aria-label="Add"
              disabled={!value}
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-text-1 text-bg disabled:opacity-40"
            >
              <Check className="size-5" />
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
