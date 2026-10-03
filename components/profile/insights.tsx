"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, LineChart, type Point } from "@/components/profile/bar-chart";
import { postJson } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { DailySummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type Range = "7" | "30" | "all";

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const logged = (d: DailySummary) => d.kcal > 0 || Number(d.protein_g) > 0;

/** Days in [start, end] with zero-filled gaps, so bars line up with the calendar. */
function series(days: Map<string, DailySummary>, start: string, end: string) {
  const out: DailySummary[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    out.push(days.get(d) ?? { logical_date: d, kcal: 0, protein_g: 0, water_ml: 0, creatine_taken: false });
  }
  return out;
}

/** All time with many days: weekly averages keep the bars readable. */
function weekly(list: DailySummary[], pick: (d: DailySummary) => number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < list.length; i += 7) {
    const week = list.slice(i, i + 7).filter(logged);
    out.push({
      label: shortDate(list[i].logical_date),
      value: week.length ? week.reduce((s, d) => s + pick(d), 0) / week.length : 0,
    });
  }
  return out;
}

function streaks(list: DailySummary[], ok: (d: DailySummary) => boolean, today: string) {
  let best = 0;
  let run = 0;
  for (const d of list) {
    run = ok(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  // Current streak counts back from today (or yesterday, if today isn't logged yet).
  let current = 0;
  const byDate = new Map(list.map((d) => [d.logical_date, d]));
  let cursor = byDate.get(today) && ok(byDate.get(today)!) ? today : addDays(today, -1);
  while (byDate.get(cursor) && ok(byDate.get(cursor)!)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, best };
}

export function useDays(active: boolean) {
  const { userId, logVersion } = useStore();
  const [days, setDays] = useState<DailySummary[] | null>(null);
  const [weights, setWeights] = useState<{ logged_on: string; weight_kg: number }[]>([]);

  useEffect(() => {
    if (!active || !userId) return;
    let cancelled = false;
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const [d, w] = await Promise.all([
        supabase.from("daily_summary").select("logical_date, kcal, protein_g, water_ml, creatine_taken").order("logical_date"),
        supabase.from("weight_logs").select("logged_on, weight_kg").order("logged_on"),
      ]);
      if (cancelled) return;
      setDays((d.data ?? []) as DailySummary[]);
      setWeights((w.data ?? []).map((r) => ({ logged_on: r.logged_on, weight_kg: Number(r.weight_kg) })));
    })();
    return () => {
      cancelled = true;
    };
  }, [active, userId, logVersion]);

  return { days, weights };
}

export function Insights({ days, weights }: { days: DailySummary[] | null; weights: { logged_on: string; weight_kg: number }[] }) {
  const { profile, today } = useStore();
  const [range, setRange] = useState<Range>("7");

  const data = useMemo(() => {
    if (!days || !today) return null;
    const map = new Map(days.map((d) => [d.logical_date, d]));
    const first = days.find(logged)?.logical_date ?? today;
    const start = range === "all" ? first : addDays(today, -(Number(range) - 1));
    const list = series(map, start < first && range === "all" ? first : start, today);
    const asPoints = (pick: (d: DailySummary) => number): Point[] =>
      list.length > 45 ? weekly(list, pick) : list.map((d) => ({ label: shortDate(d.logical_date), value: pick(d) }));

    const loggedDays = list.filter(logged);
    const t = profile?.target_protein_g ?? 0;
    const allList = series(map, first, today);
    const month = today.slice(0, 7);
    const prevMonth = addDays(`${month}-01`, -1).slice(0, 7);
    const avg = (l: DailySummary[], pick: (d: DailySummary) => number) =>
      l.length ? Math.round(l.reduce((s, d) => s + pick(d), 0) / l.length) : 0;
    const inMonth = (m: string) => days.filter((d) => d.logical_date.startsWith(m) && logged(d));

    return {
      kcal: asPoints((d) => d.kcal),
      protein: asPoints((d) => Number(d.protein_g)),
      water: asPoints((d) => d.water_ml),
      proteinHitPct: loggedDays.length ? Math.round((100 * loggedDays.filter((d) => Number(d.protein_g) >= t).length) / loggedDays.length) : 0,
      avgKcal: avg(loggedDays, (d) => d.kcal),
      logStreak: streaks(allList, logged, today),
      proteinStreak: streaks(allList, (d) => t > 0 && Number(d.protein_g) >= t, today),
      thisMonth: { kcal: avg(inMonth(month), (d) => d.kcal), protein: avg(inMonth(month), (d) => Number(d.protein_g)), days: inMonth(month).length },
      lastMonth: { kcal: avg(inMonth(prevMonth), (d) => d.kcal), protein: avg(inMonth(prevMonth), (d) => Number(d.protein_g)), days: inMonth(prevMonth).length },
      totalDays: days.filter(logged).length,
      since: first,
    };
  }, [days, today, range, profile?.target_protein_g]);

  if (!data) return <p className="text-sm text-text-3">Loading…</p>;
  if (data.totalDays === 0) return <p className="text-sm text-text-3">Insights appear after your first logged day.</p>;

  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Range" className="grid grid-cols-3 gap-1 rounded-xl border border-line p-1">
        {(
          [
            ["7", "7 days"],
            ["30", "30 days"],
            ["all", "All time"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={range === v}
            onClick={() => setRange(v)}
            className={cn("min-h-9 rounded-lg text-sm", range === v ? "bg-surface-2 text-text-1" : "text-text-3")}
          >
            {label}
          </button>
        ))}
      </div>

      <BarChart title="Calories" points={data.kcal} target={profile?.target_kcal ?? null} unit="kcal" />
      <BarChart title="Protein" points={data.protein} target={profile?.target_protein_g ?? null} unit="g" />
      <BarChart title="Water" points={data.water} target={profile?.target_water_ml ?? null} unit="ml" />
      <LineChart
        title="Weight"
        unit="kg"
        points={weights.map((w) => ({ label: shortDate(w.logged_on), value: w.weight_kg }))}
      />

      <dl className="grid grid-cols-2 gap-3">
        {[
          ["Protein target hit", `${data.proteinHitPct}% of days`],
          ["Average calories", `${data.avgKcal.toLocaleString("en-IN")} kcal`],
          ["Logging streak", `${data.logStreak.current} days (best ${data.logStreak.best})`],
          ["Protein streak", `${data.proteinStreak.current} days (best ${data.proteinStreak.best})`],
          [
            "This month",
            data.thisMonth.days ? `${data.thisMonth.kcal.toLocaleString("en-IN")} kcal · ${data.thisMonth.protein} g` : "—",
          ],
          [
            "Last month",
            data.lastMonth.days ? `${data.lastMonth.kcal.toLocaleString("en-IN")} kcal · ${data.lastMonth.protein} g` : "—",
          ],
          ["Days logged", String(data.totalDays)],
          ["Since", shortDate(data.since)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface px-3 py-2.5">
            <dt className="text-xs text-text-3">{label}</dt>
            <dd className="mt-0.5 text-sm tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Last month's AI review: generated once on the first open after the month ends. */
export function MonthlySummary({ active }: { active: boolean }) {
  const { today, userId } = useStore();
  const [state, setState] = useState<{ month: string; text: string | null } | null>(null);
  const month = today ? `${addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-01` : null;

  useEffect(() => {
    if (!active || !month || !userId || state?.month === month) return;
    let cancelled = false;
    const key = `tare.monthly.${userId}.${month}`;
    const cached = (() => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    })();
    if (cached) {
      // Shown straight from the phone's copy; no network needed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ month, text: cached });
      return;
    }
    postJson<{ text: string }>("/api/ai/monthly", { month })
      .then((r) => {
        if (cancelled) return;
        try {
          localStorage.setItem(key, r.text);
        } catch {}
        setState({ month, text: r.text });
      })
      .catch(() => !cancelled && setState({ month, text: null }));
    return () => {
      cancelled = true;
    };
  }, [active, month, userId, state?.month]);

  if (!state?.text || !month) return null;
  const name = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(new Date(`${month}T00:00:00Z`));
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs text-text-3">{name} in review</p>
      <p className="mt-1 text-sm leading-relaxed text-text-1">{state.text}</p>
    </div>
  );
}
