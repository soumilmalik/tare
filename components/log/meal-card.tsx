"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { inputClass, primaryButton, secondaryButton } from "@/components/ui/fields";
import { NumberInput } from "@/components/ui/number-input";
import { draftTotals } from "@/lib/store";
import type { MealDraft, MealItem } from "@/lib/types";

/**
 * The confirmation card (SPEC §7.6): every AI estimate lands here first.
 * Title, items, quantities and numbers are all editable; nothing is saved
 * until Log. Also used to edit an already-logged meal.
 */
export function MealCard({
  initial,
  mode,
  onSave,
  onCancel,
  onDelete,
  onReEstimate,
}: {
  initial: MealDraft;
  mode: "new" | "edit";
  onSave: (draft: MealDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
  /** Present when the meal came from AI: sends a correction for one more estimate. */
  onReEstimate?: (draft: MealDraft, correction: string) => Promise<MealDraft>;
}) {
  const [draft, setDraft] = useState<MealDraft>(initial);
  const [correction, setCorrection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totals = draftTotals(draft.items);

  const setItem = (index: number, patch: Partial<MealItem>) =>
    setDraft((d) => ({ ...d, items: d.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));

  async function reEstimate() {
    if (!onReEstimate || !correction.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setDraft(await onReEstimate(draft, correction.trim()));
      setCorrection("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const items = draft.items.filter((i) => i.name.trim() || i.kcal || i.protein);
    if (items.length === 0) return setError("Add at least one item.");
    onSave({ ...draft, items });
  }

  return (
    <div className="space-y-4">
      {draft.question && (
        <p className="rounded-xl border border-line bg-bg px-4 py-3 text-sm text-text-1">{draft.question}</p>
      )}

      <label className="block">
        <span className="sr-only">Meal title</span>
        <input
          className={`${inputClass} text-base font-medium`}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Meal title"
        />
      </label>

      <ul className="space-y-3">
        {draft.items.map((item, i) => (
          <li key={i} className="space-y-2 rounded-xl border border-line bg-bg p-3">
            <div className="flex gap-2">
              <input
                aria-label="Item"
                className={`${inputClass} h-11 flex-1`}
                value={item.name}
                placeholder="Item"
                onChange={(e) => setItem(i, { name: e.target.value })}
              />
              <button
                type="button"
                aria-label={`Remove ${item.name || "item"}`}
                onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-text-2"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-[1fr_5.5rem_5rem] gap-2">
              <input
                aria-label="Quantity"
                className={`${inputClass} h-11`}
                value={item.qty}
                placeholder="Quantity"
                onChange={(e) => setItem(i, { qty: e.target.value })}
              />
              <label className="relative">
                <span className="sr-only">Calories</span>
                <NumberInput className="h-11 pr-9" value={item.kcal} onChange={(v) => setItem(i, { kcal: v ?? 0 })} />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-3">kcal</span>
              </label>
              <label className="relative">
                <span className="sr-only">Protein</span>
                <NumberInput
                  decimal
                  className="h-11 pr-6"
                  value={item.protein}
                  onChange={(v) => setItem(i, { protein: v ?? 0 })}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-3">g</span>
              </label>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() =>
          setDraft({ ...draft, items: [...draft.items, { name: "", qty: "", kcal: 0, protein: 0 }] })
        }
        className="flex min-h-11 items-center gap-2 text-sm text-text-2"
      >
        <Plus className="size-4" /> Add item
      </button>

      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-sm text-text-2">Total</span>
        <span className="font-medium tabular-nums">
          {totals.kcal} kcal · {totals.protein} g protein
        </span>
      </div>
      {draft.assumptions && <p className="text-xs text-text-3">{draft.assumptions}</p>}

      {onReEstimate && (
        <div className="flex gap-2">
          <input
            className={`${inputClass} h-11`}
            placeholder="Correction, e.g. it was 3 rotis"
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !correction.trim()}
            onClick={reEstimate}
            className="h-11 shrink-0 rounded-xl border border-line px-3 text-sm disabled:opacity-40"
          >
            {busy ? "…" : "Re-estimate"}
          </button>
        </div>
      )}

      <p role="alert" className="min-h-5 text-sm text-text-2">
        {error}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className={secondaryButton} onClick={mode === "edit" && onDelete ? onDelete : onCancel}>
          {mode === "edit" && onDelete ? "Delete" : "Cancel"}
        </button>
        <button type="button" className={primaryButton} onClick={save} disabled={busy}>
          {mode === "edit" ? "Save" : "Log"}
        </button>
      </div>
    </div>
  );
}
