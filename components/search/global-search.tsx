"use client";

/**
 * Global search adapted from Action Search Bar by @kokonutui (kokonutui.com, MIT):
 * real local results (meals, foods, pantry, days, settings, actions) searched
 * instantly, and "Ask AI" as the last result. No ⌘K hints on mobile.
 */

import {
  CalendarDays,
  Camera,
  Download,
  GlassWater,
  ListChecks,
  MessageSquareText,
  Search,
  Send,
  Settings2,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type TabId, useAppNav } from "@/components/app-context";
import { useLogFlow } from "@/components/log/log-flow";
import { postJson } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import type { MealItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  keywords?: string;
  run: () => void;
}

interface AiAnswer {
  answer: string;
  meal: { title: string; items: MealItem[]; assumptions: string; question: string | null } | null;
}

const icon = (C: typeof Search) => <C className="size-4 text-text-2" aria-hidden />;

export function GlobalSearch({ open, initialQuery, onClose }: { open: boolean; initialQuery: string; onClose: () => void }) {
  const store = useStore();
  const nav = useAppNav();
  const flow = useLogFlow();
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(-1);
  const [pastMeals, setPastMeals] = useState<{ title: string; items: MealItem[]; date: string }[]>([]);
  const [days, setDays] = useState<{ logical_date: string; kcal: number; protein_g: number }[]>([]);
  const [ai, setAi] = useState<{ q: string; loading: boolean; answer?: AiAnswer; error?: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Load searchable history once per open (two small queries).
  useEffect(() => {
    if (!open) return;
    const since = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
    const supabase = createClient();
    void Promise.all([
      supabase
        .from("meal_logs")
        .select("title, items, logical_date")
        .is("deleted_at", null)
        .gte("logical_date", since)
        .order("logged_at", { ascending: false })
        .limit(400),
      supabase.from("daily_summary").select("logical_date, kcal, protein_g").order("logical_date", { ascending: false }).limit(120),
    ]).then(([m, d]) => {
      const seen = new Set<string>();
      setPastMeals(
        (m.data ?? [])
          .filter((r) => {
            const k = r.title.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .map((r) => ({ title: r.title, items: r.items as MealItem[], date: r.logical_date })),
      );
      setDays((d.data ?? []).filter((r) => r.kcal > 0));
    });
  }, [open]);

  const close = () => {
    onClose();
    setAi(null);
    setActive(-1);
  };
  const go = (tab: TabId, section?: string) => () => {
    close();
    nav.goTo(tab, section);
  };

  const all = useMemo<Result[]>(() => {
    const actions: Result[] = [
      { id: "a-water", label: "Add water", hint: "+250 ml", icon: icon(GlassWater), keywords: "glass drink", run: () => { store.addWater(250); close(); } },
      ...(store.profile?.takes_creatine && !store.creatine
        ? [{ id: "a-creatine", label: "Log creatine", hint: "3 g + 250 ml water", icon: icon(Sparkles), run: () => { store.setCreatine(true); close(); } }]
        : []),
      { id: "a-photo", label: "Log a meal with a photo", icon: icon(Camera), keywords: "camera", run: () => { close(); flow.pickPhotos(); } },
      { id: "a-text", label: "Log a meal by typing", icon: icon(MessageSquareText), keywords: "chat text", run: () => { close(); flow.openChat(); } },
      { id: "a-export", label: "Export data", hint: "CSV", icon: icon(Download), keywords: "download csv", run: go("profile", "export") },
    ];
    const settings: Result[] = [
      ["Targets", "targets", "calories protein water goal"],
      ["Your details", "details", "weight height age goal diet training"],
      ["Reminders", "notifications", "notifications push water creatine"],
      ["Regular meals and foods", "foods", "breakfast lunch dinner snacks"],
      ["Insights", "insights", "charts stats streak summary"],
      ["History", "history", "past days"],
    ].map(([label, section, keywords]) => ({
      id: `s-${section}`,
      label,
      hint: "Settings",
      icon: icon(Settings2),
      keywords,
      run: go("profile", section),
    }));
    const pantry: Result = {
      id: "s-pantry",
      label: "Pantry",
      hint: store.pantry.map((p) => p.ingredient).join(", ") || "Ingredients at home",
      icon: icon(ListChecks),
      keywords: `home ingredients ${store.pantry.map((p) => p.ingredient).join(" ")}`,
      run: go("ai-meals", "pantry"),
    };
    const meals: Result[] = pastMeals.map((m, i) => ({
      id: `m-${i}`,
      label: m.title,
      hint: "Log again",
      icon: icon(Utensils),
      run: () => {
        close();
        flow.openDraft({ title: m.title, items: m.items, source: "text" });
      },
    }));
    const foods: Result[] = store.regularFoods.map((f) => ({
      id: `f-${f.id}`,
      label: f.description,
      hint: `Regular · ${f.meal_slot}`,
      icon: icon(Utensils),
      run: () => {
        close();
        flow.openChat(`Estimate: ${f.description}`);
      },
    }));
    const history: Result[] = days.map((d) => ({
      id: `d-${d.logical_date}`,
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
        new Date(`${d.logical_date}T00:00:00Z`),
      ),
      hint: `${d.kcal} kcal · ${Number(d.protein_g)} g`,
      icon: icon(CalendarDays),
      keywords: d.logical_date,
      run: go("profile", "history"),
    }));
    return [...actions, ...meals, ...foods, pantry, ...settings, ...history];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.profile, store.creatine, store.pantry, store.regularFoods, pastMeals, days]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    const list = q
      ? all.filter((r) => q.split(/\s+/).every((t) => `${r.label} ${r.hint ?? ""} ${r.keywords ?? ""}`.toLowerCase().includes(t)))
      : all.filter((r) => r.id.startsWith("a-") || r.id.startsWith("s-"));
    return list.slice(0, 30);
  }, [all, q]);

  const askAi = async () => {
    const question = query.trim();
    if (question.length < 3) return;
    setAi({ q: question, loading: true });
    try {
      const answer = await postJson<AiAnswer>("/api/ai/ask", {
        question,
        remaining: {
          kcal: Math.max(0, (store.profile?.target_kcal ?? 0) - store.totals.kcal),
          protein: Math.max(0, (store.profile?.target_protein_g ?? 0) - store.totals.protein),
        },
      });
      setAi({ q: question, loading: false, answer });
    } catch (err) {
      setAi({ q: question, loading: false, error: (err as Error).message });
    }
  };

  const showAsk = q.length >= 3;
  const count = results.length + (showAsk ? 1 : 0);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return close();
    if (!count) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && active < results.length) results[active].run();
      else if (showAsk) void askAi();
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="pt-safe fixed inset-0 z-50 flex flex-col bg-bg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onAnimationComplete={() => input.current?.focus()}
        >
          <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 pt-3 pb-2">
            <div className="relative flex-1">
              <input
                ref={input}
                autoFocus
                role="combobox"
                aria-expanded
                aria-controls="search-results"
                aria-activedescendant={active >= 0 ? `result-${active}` : undefined}
                aria-label="Search"
                autoComplete="off"
                placeholder="Search meals, settings, or ask a question"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(-1);
                  setAi(null);
                }}
                onKeyDown={onKeyDown}
                className="h-12 w-full rounded-xl border border-line bg-surface pr-10 pl-4 text-text-1 placeholder:text-text-3 outline-none focus:border-text-3"
              />
              <div className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={query ? "send" : "search"}
                    className="block"
                    initial={{ y: -12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 12, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {query ? <Send className="size-4" /> : <Search className="size-4" />}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
            <button type="button" onClick={close} aria-label="Close search" className="flex size-11 items-center justify-center text-text-2">
              <X className="size-5" />
            </button>
          </div>

          <ul id="search-results" role="listbox" className="mx-auto w-full max-w-md flex-1 overflow-y-auto overscroll-contain px-2 pb-8">
            {results.map((r, i) => (
              <li key={r.id} id={`result-${i}`} role="option" aria-selected={active === i}>
                <button
                  type="button"
                  onClick={r.run}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
                    active === i ? "bg-surface-2" : "active:bg-surface",
                  )}
                >
                  {r.icon}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-1">{r.label}</span>
                    {r.hint && <span className="block truncate text-xs text-text-3">{r.hint}</span>}
                  </span>
                </button>
              </li>
            ))}
            {q && results.length === 0 && <li className="px-3 py-2 text-sm text-text-3">No matches.</li>}
            {showAsk && (
              <li id={`result-${results.length}`} role="option" aria-selected={active === results.length}>
                <button
                  type="button"
                  onClick={askAi}
                  disabled={ai?.loading}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
                    active === results.length ? "bg-surface-2" : "active:bg-surface",
                  )}
                >
                  <Sparkles className="size-4 text-text-1" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm">Ask AI: “{query.trim()}”</span>
                </button>
                {ai && ai.q === query.trim() && (
                  <div className="mx-3 mt-1 space-y-3 rounded-xl border border-line bg-surface p-4 text-sm" aria-live="polite">
                    {ai.loading && <p className="text-text-3">Thinking…</p>}
                    {ai.error && <p className="text-text-2">{ai.error}</p>}
                    {ai.answer && <p className="leading-relaxed text-text-1">{ai.answer.answer}</p>}
                    {ai.answer?.meal && (
                      <button
                        type="button"
                        onClick={() => {
                          const meal = ai.answer!.meal!;
                          close();
                          flow.openDraft({ title: meal.title, items: meal.items, source: "text", assumptions: meal.assumptions });
                        }}
                        className="flex h-10 items-center gap-2 rounded-lg bg-surface-2 px-3 text-sm"
                      >
                        <Utensils className="size-4" aria-hidden /> Log this
                      </button>
                    )}
                  </div>
                )}
              </li>
            )}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
