"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { inputClass } from "@/components/ui/fields";
import { useStore } from "@/lib/store";

/** Quick add/remove of ingredients usually at home. */
export function PantryEditor() {
  const { pantry, addPantry, removePantry } = useStore();
  const [text, setText] = useState("");

  return (
    <div className="space-y-3">
      {pantry.length === 0 ? (
        <p className="text-sm text-text-3">Nothing added yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {pantry.map((p) => (
            <li key={p.id} className="flex h-9 items-center gap-1 rounded-full border border-line pr-1 pl-3 text-sm">
              {p.ingredient}
              <button
                type="button"
                aria-label={`Remove ${p.ingredient}`}
                onClick={() => removePantry(p.id)}
                className="flex size-7 items-center justify-center rounded-full text-text-3"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addPantry(text);
          setText("");
        }}
      >
        <input
          className={`${inputClass} h-11`}
          placeholder="Add an ingredient"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          aria-label="Add ingredient"
          disabled={!text.trim()}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </form>
    </div>
  );
}
