"use client";

const HOURS = [0, 1, 2, 3, 4, 5, 6];

export const formatHour = (h: number) =>
  new Intl.DateTimeFormat("en-IN", { hour: "numeric", timeZone: "UTC" }).format(Date.UTC(2000, 0, 1, h));

/** "My day starts at" picker (midnight to 6 AM). Late-night snacks before it count for the previous day. */
export function DayStartSelect({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (hour: number) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-11 rounded-xl border border-line bg-bg px-3 text-text-1"
    >
      {HOURS.map((h) => (
        <option key={h} value={h}>
          {h === 0 ? "12 AM (midnight)" : formatHour(h)}
        </option>
      ))}
    </select>
  );
}
