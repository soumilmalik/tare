import { cn } from "@/lib/utils";

export const inputClass =
  "h-12 w-full rounded-xl border border-line bg-bg px-4 text-text-1 placeholder:text-text-3 outline-none focus:border-text-3";
export const primaryButton =
  "h-12 w-full rounded-xl bg-text-1 font-medium text-bg transition-opacity active:opacity-80 disabled:opacity-40";
export const secondaryButton =
  "h-12 w-full rounded-xl border border-line bg-surface text-text-1 transition-opacity active:opacity-80 disabled:opacity-40";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-sm text-text-2">{label}</span>
      {children}
      {hint && <span className="block text-xs text-text-3">{hint}</span>}
    </label>
  );
}

/** Pill-style single choice. */
export function Choice<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: number;
}) {
  return (
    <div role="radiogroup" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-12 rounded-xl border px-3 text-sm transition-colors",
            value === o.value ? "border-text-1 bg-text-1 text-bg" : "border-line bg-bg text-text-1",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** iOS-style on/off switch. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border p-0 transition-colors",
        checked ? "border-text-1 bg-text-1" : "border-line bg-surface-2",
      )}
    >
      <span
        className={cn(
          // Pinned to the left edge; iOS otherwise centres it inside the button.
          "absolute top-[2px] left-[2px] size-[22px] rounded-full transition-transform duration-200",
          checked ? "translate-x-[20px] bg-bg" : "translate-x-0 bg-text-2",
        )}
      />
    </button>
  );
}

