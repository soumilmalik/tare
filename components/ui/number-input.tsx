"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui/fields";
import { cn } from "@/lib/utils";

/** Number field with the numeric keypad; keeps what was typed (e.g. "65.") while editing. */
export function NumberInput({
  value,
  onChange,
  decimal = false,
  className,
  ...rest
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  decimal?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(value == null ? "" : String(value));
  // Follow outside changes (e.g. a reset) without fighting the user's typing.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== (text === "" ? null : Number(text))) setText(value == null ? "" : String(value));
  }

  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={text}
      onChange={(e) => {
        let raw = e.target.value.replace(decimal ? /[^0-9.]/g : /\D/g, "");
        if (decimal) raw = raw.replace(/(\..*)\./g, "$1");
        setText(raw);
        const n = raw === "" || raw === "." ? null : Number(raw);
        setSeen(n);
        onChange(n);
      }}
      className={cn(inputClass, className)}
      {...rest}
    />
  );
}
