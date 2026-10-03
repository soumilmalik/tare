"use client";

import { ChevronDown } from "lucide-react";
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
import { Field, inputClass, primaryButton, secondaryButton, Toggle } from "@/components/ui/fields";
import { NumberInput } from "@/components/ui/number-input";
import { Sheet } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { enablePush, pushPermission, pushSupport } from "@/lib/push";
import { useStore } from "@/lib/store";
import { calculateTargets, targetInputFromProfile } from "@/lib/targets";
import type { DailySummary, MealLog, MealSlot, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  action,
  children,
}: {
  id?: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-8 scroll-mt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm text-text-2">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const editLink = "min-h-9 px-1 text-sm text-text-1 underline underline-offset-4";

const LABELS: Record<string, string> = {
  veg: "Vegetarian",
  egg: "Eggetarian",
  "non-veg": "Non-vegetarian",
  strength: "Strength",
  cardio: "Cardio",
  sports: "Sports",
  yoga: "Yoga",
  mixed: "Mixed",
};

// --- Details -----------------------------------------------------------------

export function DetailsSection() {
  const { profile, saveProfile } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<ReturnType<typeof calculateTargets> | null>(null);
  if (!profile) return null;

  async function save() {
    for (const step of ["basics", "body", "training", "diet"] as const) {
      const problem = validate(step, draft);
      if (problem) return setError(problem);
    }
    setBusy(true);
    const before = profile!;
    const err = await saveProfile({ ...draft, name: draft.name?.trim() ?? null });
    setBusy(false);
    if (err) return setError(err);
    setOpen(false);
    // Offer (don't auto-apply) new targets when something that drives them changed.
    const keys = ["weight_kg", "goal_weight_kg", "timeline_weeks", "workout_days_per_week", "workout_type", "workout_minutes", "age", "height_cm", "sex"] as const;
    if (keys.some((k) => String(before[k] ?? "") !== String(draft[k] ?? ""))) {
      const input = targetInputFromProfile(draft);
      if (input) setSuggested(calculateTargets(input));
    }
  }

  const rows: [string, string][] = [
    ["Age", profile.age ? `${profile.age}` : "—"],
    ["Height", profile.height_cm ? `${Number(profile.height_cm)} cm` : "—"],
    ["Weight", profile.weight_kg ? `${Number(profile.weight_kg)} kg` : "—"],
    ["Goal", profile.goal_weight_kg ? `${Number(profile.goal_weight_kg)} kg in ${profile.timeline_weeks} weeks` : "—"],
    [
      "Training",
      profile.workout_type
        ? `${profile.workout_days_per_week}×/week · ${LABELS[profile.workout_type]} · ${profile.workout_minutes} min`
        : "—",
    ],
    ["Diet", profile.diet_type ? LABELS[profile.diet_type] : "—"],
    ["Avoid", profile.allergies_or_avoid || "—"],
  ];

  return (
    <Section
      id="details"
      title="Your details"
      action={
        <button
          type="button"
          className={editLink}
          onClick={() => {
            setDraft(draftFromProfile(profile));
            setError(null);
            setOpen(true);
          }}
        >
          Edit
        </button>
      }
    >
      <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-text-2">{k}</dt>
            <dd className="text-right text-text-1">{v}</dd>
          </div>
        ))}
      </dl>

      {suggested && (
        <SuggestedTargets
          suggested={suggested}
          onDone={() => setSuggested(null)}
          apply={() =>
            saveProfile({
              target_kcal: suggested.kcal,
              target_protein_g: suggested.proteinG,
              target_water_ml: suggested.waterMl,
            })
          }
        />
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Edit details">
        <div className="space-y-8">
          <BasicsFields value={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
          <BodyFields value={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
          <TrainingFields value={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
          <DietFields value={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
          <p role="alert" className="min-h-5 text-sm text-text-2">
            {error}
          </p>
          <button type="button" className={primaryButton} onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </Sheet>
    </Section>
  );
}

function SuggestedTargets({
  suggested,
  apply,
  onDone,
}: {
  suggested: ReturnType<typeof calculateTargets>;
  apply: () => Promise<string | null>;
  onDone: () => void;
}) {
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-text-3 bg-surface p-4">
      <p className="text-sm">
        New suggested targets: <span className="tabular-nums">{suggested.kcal} kcal · {suggested.proteinG} g protein · {suggested.waterMl} ml water</span>
      </p>
      {suggested.timelineNote && <p className="text-xs text-text-2">{suggested.timelineNote}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className={secondaryButton} onClick={onDone}>
          Keep mine
        </button>
        <button
          type="button"
          className={primaryButton}
          onClick={async () => {
            await apply();
            onDone();
          }}
        >
          Use these
        </button>
      </div>
    </div>
  );
}

// --- Targets -------------------------------------------------------------------

export function TargetsSection() {
  const { profile, saveProfile } = useStore();
  const [kcal, setKcal] = useState<number | null>(profile?.target_kcal ?? null);
  const [protein, setProtein] = useState<number | null>(profile?.target_protein_g ?? null);
  const [water, setWater] = useState<number | null>(profile?.target_water_ml ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const calculated = useMemo(() => {
    const input = profile && targetInputFromProfile(profile);
    return input ? calculateTargets(input) : null;
  }, [profile]);
  if (!profile) return null;

  const dirty = kcal !== profile.target_kcal || protein !== profile.target_protein_g || water !== profile.target_water_ml;

  async function save(k = kcal, p = protein, w = water) {
    if (!k || k < 800 || k > 6000) return setMsg("Calories should be between 800 and 6000.");
    if (!p || p < 20 || p > 400) return setMsg("Protein should be between 20 and 400 g.");
    if (!w || w < 500 || w > 8000) return setMsg("Water should be between 500 and 8000 ml.");
    const err = await saveProfile({ target_kcal: k, target_protein_g: p, target_water_ml: w });
    setMsg(err ?? "Saved.");
  }

  return (
    <Section id="targets" title="Daily targets">
      <div className="grid grid-cols-3 gap-2">
        <Field label="kcal">
          <NumberInput value={kcal} onChange={setKcal} />
        </Field>
        <Field label="Protein g">
          <NumberInput value={protein} onChange={setProtein} />
        </Field>
        <Field label="Water ml">
          <NumberInput value={water} onChange={setWater} />
        </Field>
      </div>
      {calculated && (
        <p className="mt-2 text-xs text-text-3">
          Calculated for you: {calculated.kcal} kcal · {calculated.proteinG} g · {calculated.waterMl} ml.{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => {
              setKcal(calculated.kcal);
              setProtein(calculated.proteinG);
              setWater(calculated.waterMl);
              void save(calculated.kcal, calculated.proteinG, calculated.waterMl);
            }}
          >
            Use these
          </button>
        </p>
      )}
      {dirty && (
        <button type="button" className={`${primaryButton} mt-3`} onClick={() => save()}>
          Save targets
        </button>
      )}
      {msg && <p className="mt-2 text-sm text-text-2">{msg}</p>}
    </Section>
  );
}

// --- Regular foods, creatine -----------------------------------------------

const SLOTS: [MealSlot, string][] = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snack", "Snacks"],
  ["regular", "Other regulars"],
];

export function FoodsSection() {
  const { regularFoods, setRegularFoods } = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<Record<MealSlot, string>>({ breakfast: "", lunch: "", dinner: "", snack: "", regular: "" });
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    const next = { breakfast: "", lunch: "", dinner: "", snack: "", regular: "" } as Record<MealSlot, string>;
    for (const f of regularFoods) next[f.meal_slot] = next[f.meal_slot] ? `${next[f.meal_slot]}\n${f.description}` : f.description;
    setText(next);
    setError(null);
    setOpen(true);
  }

  async function save() {
    const foods = SLOTS.flatMap(([slot]) =>
      text[slot]
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((description) => ({ meal_slot: slot, description, typical_kcal: null, typical_protein: null })),
    );
    const err = await setRegularFoods(foods);
    if (err) return setError(err);
    setOpen(false);
  }

  return (
    <Section id="foods" title="Regular meals and foods" action={<button type="button" className={editLink} onClick={startEdit}>Edit</button>}>
      {regularFoods.length === 0 ? (
        <p className="text-sm text-text-3">None yet. Adding them makes estimates and suggestions better.</p>
      ) : (
        <dl className="space-y-2 text-sm">
          {SLOTS.map(([slot, label]) => {
            const items = regularFoods.filter((f) => f.meal_slot === slot);
            if (!items.length) return null;
            return (
              <div key={slot}>
                <dt className="text-xs text-text-3">{label}</dt>
                <dd className="text-text-1">{items.map((i) => i.description).join(" · ")}</dd>
              </div>
            );
          })}
        </dl>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Regular meals and foods">
        <div className="space-y-4">
          {SLOTS.map(([slot, label]) => (
            <Field key={slot} label={label} hint="One per line">
              <div className="flex items-start gap-2">
                <textarea
                  rows={2}
                  className={`${inputClass} h-auto flex-1 py-3`}
                  value={text[slot]}
                  onChange={(e) => setText((t) => ({ ...t, [slot]: e.target.value }))}
                />
                <DictateButton onText={(v) => setText((t) => ({ ...t, [slot]: t[slot] ? `${t[slot]}\n${v}` : v }))} />
              </div>
            </Field>
          ))}
          <p role="alert" className="min-h-5 text-sm text-text-2">
            {error}
          </p>
          <button type="button" className={primaryButton} onClick={save}>
            Save
          </button>
        </div>
      </Sheet>
    </Section>
  );
}

export function CreatineSection() {
  const { profile, saveProfile } = useStore();
  if (!profile) return null;
  return (
    <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
      <span className="text-sm">I take creatine</span>
      <Toggle label="I take creatine" checked={profile.takes_creatine} onChange={(v) => void saveProfile({ takes_creatine: v })} />
    </div>
  );
}

// --- Notifications -----------------------------------------------------------

export function NotificationsSection() {
  const { profile, saveProfile } = useStore();
  const [status, setStatus] = useState<string | null>(null);
  const [permission, setPermission] = useState<string>("default");
  const [support, setSupport] = useState<ReturnType<typeof pushSupport>>("ok");
  useEffect(() => {
    // Browser-only checks; run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(pushSupport());
    setPermission(pushPermission());
  }, []);
  if (!profile) return null;

  const set = (patch: Partial<Profile>) => void saveProfile(patch);
  const row = "flex items-center justify-between gap-3 px-4 py-3";
  const time = (value: string, onChange: (v: string) => void, label: string) => (
    <input
      type="time"
      aria-label={label}
      value={value.slice(0, 5)}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="h-9 rounded-lg border border-line bg-bg px-2 text-sm text-text-1"
    />
  );

  return (
    <Section id="notifications" title="Reminders">
      {support === "install-first" ? (
        <p className="mb-3 text-sm text-text-2">
          To get reminders on iPhone: in Safari tap Share → Add to Home Screen, open Tare from the Home Screen, then come back here.
        </p>
      ) : permission !== "granted" ? (
        <div className="mb-3 space-y-2">
          <button
            type="button"
            className={secondaryButton}
            onClick={async () => {
              const err = await enablePush();
              setStatus(err ?? "Reminders are on for this phone.");
              setPermission(pushPermission());
            }}
          >
            Turn on notifications
          </button>
          {permission === "denied" && (
            <p className="text-xs text-text-3">Notifications are blocked. Turn them on in iPhone Settings → Notifications → Tare.</p>
          )}
        </div>
      ) : null}
      {status && <p className="mb-3 text-sm text-text-2">{status}</p>}

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        <div className={row}>
          <span className="text-sm">
            Low water
            <span className="block text-xs text-text-3">If you&apos;re below {Math.max(1500, Math.round(0.75 * (profile.target_water_ml ?? 2000)))} ml</span>
          </span>
          <span className="flex items-center gap-3">
            {profile.notify_water && time(profile.water_reminder_time, (v) => set({ water_reminder_time: v }), "Water reminder time")}
            <Toggle label="Water reminder" checked={profile.notify_water} onChange={(v) => set({ notify_water: v })} />
          </span>
        </div>
        {profile.takes_creatine && (
          <div className={row}>
            <span className="text-sm">Creatine</span>
            <span className="flex items-center gap-3">
              {profile.notify_creatine &&
                time(profile.creatine_reminder_time, (v) => set({ creatine_reminder_time: v }), "Creatine reminder time")}
              <Toggle label="Creatine reminder" checked={profile.notify_creatine} onChange={(v) => set({ notify_creatine: v })} />
            </span>
          </div>
        )}
        <div className={row}>
          <span className="text-sm">
            Meal nudge
            <span className="block text-xs text-text-3">If nothing is logged by 2 PM</span>
          </span>
          <Toggle label="Meal nudge" checked={profile.notify_meal_nudge} onChange={(v) => set({ notify_meal_nudge: v })} />
        </div>
      </div>
    </Section>
  );
}

// --- Export ----------------------------------------------------------------------

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportSection() {
  const { profile } = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function exportCsv() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const [days, meals] = await Promise.all([
      supabase.from("daily_summary").select("logical_date, kcal, protein_g, water_ml, creatine_taken").order("logical_date"),
      supabase
        .from("meal_logs")
        .select("logical_date, logged_at, title, total_kcal, total_protein, source")
        .is("deleted_at", null)
        .order("logged_at"),
    ]);
    setBusy(false);
    if (days.error || meals.error) return setMsg("Couldn't export. Check your connection.");
    const tz = profile?.timezone ?? "Asia/Kolkata";
    const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
    const lines = [
      ["record", "date", "time", "title", "kcal", "protein_g", "water_ml", "creatine", "source"],
      ...(days.data ?? []).map((d) => ["day", d.logical_date, "", "", d.kcal, d.protein_g, d.water_ml, d.creatine_taken ? "yes" : "no", ""]),
      ...(meals.data ?? []).map((m) => ["meal", m.logical_date, time(m.logged_at), m.title, m.total_kcal, m.total_protein, "", "", m.source]),
    ];
    const csv = lines.map((l) => l.map(csvCell).join(",")).join("\n");
    const file = new File([csv], `tare-export-${new Date().toISOString().slice(0, 10)}.csv`, { type: "text/csv" });
    // iPhone home-screen apps handle the share sheet better than downloads.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Tare export" });
        return;
      } catch {
        // Cancelled: fall through to a normal download.
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Section id="export" title="Export">
      <button type="button" className={secondaryButton} onClick={exportCsv} disabled={busy}>
        {busy ? "Preparing…" : "Download CSV"}
      </button>
      {msg && <p className="mt-2 text-sm text-text-2">{msg}</p>}
    </Section>
  );
}

// --- Usage & cost (admin only) ------------------------------------------------

export function UsageSection({ active }: { active: boolean }) {
  const [rows, setRows] = useState<{ email: string; month: string; calls: number; inr: number }[] | null>(null);
  useEffect(() => {
    if (!active || rows) return;
    fetch("/api/admin/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRows(d.usage))
      .catch(() => {});
  }, [active, rows]);
  if (!rows) return null;

  return (
    <Section id="usage" title="Usage and cost (admin)">
      {rows.length === 0 ? (
        <p className="text-sm text-text-3">No AI calls yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-3">
              <th className="py-1 font-normal">Month</th>
              <th className="py-1 font-normal">User</th>
              <th className="py-1 text-right font-normal">Calls</th>
              <th className="py-1 text-right font-normal">₹</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={`${r.email}${r.month}`} className="border-t border-line">
                <td className="py-2">{r.month}</td>
                <td className="max-w-32 truncate py-2">{r.email}</td>
                <td className="py-2 text-right">{r.calls}</td>
                <td className="py-2 text-right">{r.inr.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

// --- History --------------------------------------------------------------------

export function HistorySection({ days }: { days: DailySummary[] | null }) {
  const { profile, today } = useStore();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [meals, setMeals] = useState<MealLog[] | null>(null);
  const tz = profile?.timezone ?? "Asia/Kolkata";

  const list = useMemo(
    () => (days ?? []).filter((d) => d.logical_date !== today && (d.kcal > 0 || d.water_ml > 0)).reverse(),
    [days, today],
  );

  async function openDay(date: string) {
    setDay(date);
    setMeals(null);
    const { data } = await createClient()
      .from("meal_logs")
      .select("*")
      .eq("logical_date", date)
      .is("deleted_at", null)
      .order("logged_at");
    setMeals((data ?? []) as MealLog[]);
  }

  const label = (iso: string) =>
    new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <section id="history" className="mt-10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between text-sm text-text-3"
      >
        History
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="divide-y divide-line">
          {list.length === 0 && <li className="py-3 text-sm text-text-3">No past days yet.</li>}
          {list.map((d) => (
            <li key={d.logical_date}>
              <button
                type="button"
                onClick={() => openDay(d.logical_date)}
                className="flex w-full items-center justify-between gap-2 py-3 text-left text-sm"
              >
                <span className="text-text-2">{label(d.logical_date)}</span>
                <span className="tabular-nums text-text-1">
                  {d.kcal} kcal · {Number(d.protein_g)} g · {d.water_ml} ml{d.creatine_taken ? " · ✓" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!day} onClose={() => setDay(null)} title={day ? label(day) : ""}>
        {!meals ? (
          <p className="text-sm text-text-3">Loading…</p>
        ) : meals.length === 0 ? (
          <p className="text-sm text-text-3">No meals logged.</p>
        ) : (
          <ul className="space-y-2">
            {meals.map((m) => (
              <li key={m.id} className="flex justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{m.title}</span>
                  <span className="text-xs text-text-3">
                    {new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(m.logged_at))}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {m.total_kcal} kcal
                  <span className="block text-xs text-text-2">{Number(m.total_protein)} g</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </section>
  );
}
