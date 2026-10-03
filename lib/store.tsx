"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_TZ, logicalDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { enqueue, flush, pendingOps } from "@/lib/sync-queue";
import type { MealDraft, MealLog, PantryItem, Profile, RegularFood } from "@/lib/types";
import { useLogicalDate } from "@/lib/use-logical-date";

/**
 * App-wide data: profile, today's meals, water and creatine. Reads come from
 * a localStorage cache first (instant start), then refresh from Supabase.
 * Writes update the screen immediately and go through the offline queue.
 */

const CREATINE_WATER_ML = 250;

interface WaterLog {
  id: string;
  ml: number;
}

interface Cache {
  profile: Profile | null;
  regularFoods: RegularFood[];
  pantry: PantryItem[];
  date: string | null;
  meals: MealLog[];
  water: WaterLog[];
  creatine: boolean;
}

const EMPTY: Cache = {
  profile: null,
  regularFoods: [],
  pantry: [],
  date: null,
  meals: [],
  water: [],
  creatine: false,
};

export interface Store extends Cache {
  ready: boolean;
  userId: string | null;
  email: string | null;
  today: string | null;
  online: boolean;
  totals: { kcal: number; protein: number; water: number };
  /** Bumped whenever logged food changes; used to invalidate cached AI suggestions. */
  logVersion: number;
  addWater: (ml: 250 | -250) => void;
  setCreatine: (taken: boolean) => void;
  addMeal: (draft: MealDraft) => MealLog | null;
  updateMeal: (id: string, draft: MealDraft) => void;
  softDeleteMeal: (id: string) => void;
  undoDeleteMeal: (id: string) => void;
  hardDeleteMeal: (id: string) => void;
  saveProfile: (patch: Partial<Profile>) => Promise<string | null>;
  setRegularFoods: (foods: Omit<RegularFood, "id">[]) => Promise<string | null>;
  addPantry: (ingredient: string) => void;
  removePantry: (id: string) => void;
  refresh: () => Promise<void>;
}

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

const cacheKey = (userId: string) => `tare.cache.${userId}`;

function readCache(userId: string): Cache {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(cacheKey(userId)) ?? "{}") };
  } catch {
    return EMPTY;
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function draftTotals(items: MealDraft["items"]) {
  return {
    kcal: Math.round(items.reduce((s, i) => s + (Number(i.kcal) || 0), 0)),
    protein: round1(items.reduce((s, i) => s + (Number(i.protein) || 0), 0)),
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<Cache>(EMPTY);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [logVersion, setLogVersion] = useState(0);
  const deleted = useRef(new Map<string, MealLog>());
  // Latest data for event handlers, so queue writes never run inside a state updater.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const tz = data.profile?.timezone ?? DEFAULT_TZ;
  const today = useLogicalDate(tz);

  // Persist every change to the cache.
  useEffect(() => {
    if (!userId || !ready) return;
    try {
      localStorage.setItem(cacheKey(userId), JSON.stringify(data));
    } catch {
      // Cache is a speed-up only.
    }
  }, [data, userId, ready]);

  // Who is signed in (read from the local session cookie; no network).
  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          window.location.replace("/login");
          return;
        }
        const id = session.user.id;
        setUserId(id);
        setEmail(session.user.email ?? null);
        const cached = readCache(id);
        setData(cached);
        if (cached.profile) setReady(true);
      });
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<Profile>();
    if (error || !profile) {
      setReady(true);
      return;
    }
    const date = logicalDate(new Date(), profile.timezone);
    const [foods, pantry, meals, water, summary] = await Promise.all([
      supabase.from("regular_foods").select("id, meal_slot, description, typical_kcal, typical_protein").order("created_at"),
      supabase.from("pantry").select("id, ingredient").order("ingredient"),
      supabase
        .from("meal_logs")
        .select("*")
        .eq("logical_date", date)
        .is("deleted_at", null)
        .order("logged_at"),
      supabase.from("water_logs").select("id, ml").eq("logical_date", date),
      supabase
        .from("daily_summary")
        .select("creatine_taken")
        .eq("logical_date", date)
        .maybeSingle<{ creatine_taken: boolean }>(),
    ]);

    const next: Cache = {
      profile,
      regularFoods: (foods.data ?? []) as RegularFood[],
      pantry: (pantry.data ?? []) as PantryItem[],
      date,
      meals: (meals.data ?? []) as MealLog[],
      water: (water.data ?? []) as WaterLog[],
      creatine: summary.data?.creatine_taken ?? false,
    };
    setData(applyPending(next, pendingOps(userId)));
    setReady(true);
  }, [userId]);

  // Load on sign-in and whenever the logical day rolls over.
  useEffect(() => {
    // Fetches from Supabase; state updates happen after the network calls.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (userId) void refresh();
  }, [userId, today, refresh]);

  // Keep the queue moving and track connectivity.
  useEffect(() => {
    if (!userId) return;
    const sync = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void flush(userId);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        sync();
        void refresh();
      }
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(sync, 30_000);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [userId, refresh]);

  const date = today ?? data.date;

  const waterRow = useCallback(
    (ml: number) => {
      const row = { id: crypto.randomUUID(), ml };
      enqueue(userId!, {
        kind: "insert",
        table: "water_logs",
        row: { ...row, logical_date: date, logged_at: new Date().toISOString() },
      });
      return row;
    },
    [userId, date],
  );

  const addWater = useCallback(
    (ml: 250 | -250) => {
      if (!userId || !date) return;
      const d = dataRef.current;
      const current = d.date === date ? d.water.reduce((s, w) => s + w.ml, 0) : 0;
      if (ml < 0 && current <= 0) return;
      const row = waterRow(ml);
      const next = { ...d, date, water: [...(d.date === date ? d.water : []), row] };
      dataRef.current = next;
      setData(next);
    },
    [userId, date, waterRow],
  );

  const setCreatine = useCallback(
    (taken: boolean) => {
      if (!userId || !date) return;
      enqueue(userId, {
        kind: "upsert",
        table: "daily_summary",
        row: { user_id: userId, logical_date: date, creatine_taken: taken },
        onConflict: "user_id,logical_date",
      });
      // Logging creatine also logs the glass of water taken with it; undo removes it.
      const d = dataRef.current;
      let water = d.date === date ? d.water : [];
      if (taken) water = [...water, waterRow(CREATINE_WATER_ML)];
      else if (water.reduce((s, w) => s + w.ml, 0) > 0) water = [...water, waterRow(-CREATINE_WATER_ML)];
      const next = { ...d, date, creatine: taken, water };
      dataRef.current = next;
      setData(next);
    },
    [userId, date, waterRow],
  );

  const addMeal = useCallback(
    (draft: MealDraft): MealLog | null => {
      if (!userId || !date) return null;
      const totals = draftTotals(draft.items);
      const meal: MealLog = {
        id: crypto.randomUUID(),
        logical_date: date,
        logged_at: new Date().toISOString(),
        title: draft.title.trim() || "Meal",
        items: draft.items,
        total_kcal: totals.kcal,
        total_protein: totals.protein,
        source: draft.source,
        user_edited: false,
        deleted_at: null,
      };
      enqueue(userId, { kind: "insert", table: "meal_logs", row: { ...meal } });
      setData((d) => ({ ...d, meals: [...d.meals, meal] }));
      setLogVersion((v) => v + 1);
      return meal;
    },
    [userId, date],
  );

  const updateMeal = useCallback(
    (id: string, draft: MealDraft) => {
      if (!userId) return;
      const totals = draftTotals(draft.items);
      const patch = {
        title: draft.title.trim() || "Meal",
        items: draft.items,
        total_kcal: totals.kcal,
        total_protein: totals.protein,
        user_edited: true,
      };
      enqueue(userId, { kind: "update", table: "meal_logs", match: { id }, patch });
      setData((d) => ({ ...d, meals: d.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
      setLogVersion((v) => v + 1);
    },
    [userId],
  );

  const softDeleteMeal = useCallback(
    (id: string) => {
      if (!userId) return;
      const meal = dataRef.current.meals.find((m) => m.id === id);
      if (meal) deleted.current.set(id, meal);
      setData((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== id) }));
      enqueue(userId, {
        kind: "update",
        table: "meal_logs",
        match: { id },
        patch: { deleted_at: new Date().toISOString() },
      });
      setLogVersion((v) => v + 1);
    },
    [userId],
  );

  const undoDeleteMeal = useCallback(
    (id: string) => {
      if (!userId) return;
      const meal = deleted.current.get(id);
      if (!meal) return;
      deleted.current.delete(id);
      enqueue(userId, { kind: "update", table: "meal_logs", match: { id }, patch: { deleted_at: null } });
      setData((d) => ({
        ...d,
        meals: [...d.meals, meal].sort((a, b) => a.logged_at.localeCompare(b.logged_at)),
      }));
      setLogVersion((v) => v + 1);
    },
    [userId],
  );

  const hardDeleteMeal = useCallback(
    (id: string) => {
      if (!userId || !deleted.current.has(id)) return;
      deleted.current.delete(id);
      enqueue(userId, { kind: "delete", table: "meal_logs", match: { id } });
    },
    [userId],
  );

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!userId) return "Not signed in";
      const { data: row, error } = await createClient()
        .from("profiles")
        .update(patch)
        .eq("user_id", userId)
        .select("*")
        .single<Profile>();
      if (error) return error.message;
      // Keep a weight history for the Insights trend.
      if (patch.weight_kg && row) {
        await createClient()
          .from("weight_logs")
          .upsert(
            {
              user_id: userId,
              logged_on: logicalDate(new Date(), row.timezone),
              weight_kg: patch.weight_kg,
            },
            { onConflict: "user_id,logged_on" },
          );
      }
      setData((d) => ({ ...d, profile: row }));
      return null;
    },
    [userId],
  );

  const setRegularFoods = useCallback(
    async (foods: Omit<RegularFood, "id">[]) => {
      if (!userId) return "Not signed in";
      const supabase = createClient();
      const del = await supabase.from("regular_foods").delete().eq("user_id", userId);
      if (del.error) return del.error.message;
      if (foods.length === 0) {
        setData((d) => ({ ...d, regularFoods: [] }));
        return null;
      }
      const { data: rows, error } = await supabase
        .from("regular_foods")
        .insert(foods)
        .select("id, meal_slot, description, typical_kcal, typical_protein");
      if (error) return error.message;
      setData((d) => ({ ...d, regularFoods: rows as RegularFood[] }));
      return null;
    },
    [userId],
  );

  const addPantry = useCallback(
    (ingredient: string) => {
      const name = ingredient.trim();
      const d = dataRef.current;
      if (!userId || !name) return;
      if (d.pantry.some((p) => p.ingredient.toLowerCase() === name.toLowerCase())) return;
      const row = { id: crypto.randomUUID(), ingredient: name };
      enqueue(userId, { kind: "insert", table: "pantry", row });
      setData((cur) => ({
        ...cur,
        pantry: [...cur.pantry, row].sort((a, b) => a.ingredient.localeCompare(b.ingredient)),
      }));
      setLogVersion((v) => v + 1);
    },
    [userId],
  );

  const removePantry = useCallback(
    (id: string) => {
      if (!userId) return;
      enqueue(userId, { kind: "delete", table: "pantry", match: { id } });
      setData((d) => ({ ...d, pantry: d.pantry.filter((p) => p.id !== id) }));
      setLogVersion((v) => v + 1);
    },
    [userId],
  );

  // If the cache is from an earlier day, today's lists start empty.
  const isToday = data.date === date;
  const meals = useMemo(() => (isToday ? data.meals : []), [isToday, data.meals]);
  const water = useMemo(() => (isToday ? data.water : []), [isToday, data.water]);
  const creatine = isToday ? data.creatine : false;

  const totals = useMemo(
    () => ({
      kcal: Math.round(meals.reduce((s, m) => s + Number(m.total_kcal), 0)),
      protein: round1(meals.reduce((s, m) => s + Number(m.total_protein), 0)),
      water: Math.max(0, water.reduce((s, w) => s + w.ml, 0)),
    }),
    [meals, water],
  );

  const value: Store = {
    ...data,
    meals,
    water,
    creatine,
    ready,
    userId,
    email,
    today: date,
    online,
    totals,
    logVersion,
    addWater,
    setCreatine,
    addMeal,
    updateMeal,
    softDeleteMeal,
    undoDeleteMeal,
    hardDeleteMeal,
    saveProfile,
    setRegularFoods,
    addPantry,
    removePantry,
    refresh,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** Re-applies changes still waiting in the offline queue on top of fresh server data. */
function applyPending(next: Cache, ops: ReturnType<typeof pendingOps>): Cache {
  let { meals, water, creatine, pantry } = next;
  for (const op of ops) {
    if (op.kind === "insert" && op.table === "water_logs" && op.row.logical_date === next.date) {
      if (!water.some((w) => w.id === op.row.id)) water = [...water, { id: String(op.row.id), ml: Number(op.row.ml) }];
    } else if (op.kind === "insert" && op.table === "meal_logs" && op.row.logical_date === next.date) {
      if (!meals.some((m) => m.id === op.row.id)) meals = [...meals, op.row as unknown as MealLog];
    } else if (op.kind === "update" && op.table === "meal_logs") {
      if (op.patch.deleted_at) meals = meals.filter((m) => m.id !== op.match.id);
      else meals = meals.map((m) => (m.id === op.match.id ? { ...m, ...op.patch } : m));
    } else if (op.kind === "delete" && op.table === "meal_logs") {
      meals = meals.filter((m) => m.id !== op.match.id);
    } else if (op.kind === "upsert" && op.table === "daily_summary" && op.row.logical_date === next.date) {
      creatine = Boolean(op.row.creatine_taken);
    } else if (op.kind === "insert" && op.table === "pantry") {
      if (!pantry.some((p) => p.id === op.row.id)) pantry = [...pantry, op.row as unknown as PantryItem];
    } else if (op.kind === "delete" && op.table === "pantry") {
      pantry = pantry.filter((p) => p.id !== op.match.id);
    }
  }
  return { ...next, meals, water, creatine, pantry };
}
