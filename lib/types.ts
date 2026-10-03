export type Sex = "male" | "female";
export type WorkoutType = "strength" | "cardio" | "sports" | "yoga" | "mixed";
export type DietType = "veg" | "egg" | "non-veg";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack" | "regular";
export type MealSource = "photo" | "voice" | "text" | "manual";

export interface Profile {
  user_id: string;
  name: string | null;
  sex: Sex | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal_weight_kg: number | null;
  timeline_weeks: number | null;
  workout_days_per_week: number | null;
  workout_type: WorkoutType | null;
  workout_minutes: number | null;
  diet_type: DietType | null;
  allergies_or_avoid: string | null;
  takes_creatine: boolean;
  target_kcal: number | null;
  target_protein_g: number | null;
  target_water_ml: number | null;
  timezone: string;
  notify_water: boolean;
  water_reminder_time: string;
  notify_creatine: boolean;
  creatine_reminder_time: string;
  notify_meal_nudge: boolean;
  onboarded_at: string | null;
}

export interface MealItem {
  name: string;
  qty: string;
  kcal: number;
  protein: number;
  carbs?: number;
  fat?: number;
  fibre?: number;
}

export interface MealLog {
  id: string;
  logical_date: string;
  logged_at: string;
  title: string;
  items: MealItem[];
  total_kcal: number;
  total_protein: number;
  source: MealSource;
  user_edited: boolean;
  deleted_at: string | null;
}

export interface DailySummary {
  logical_date: string;
  kcal: number;
  protein_g: number;
  water_ml: number;
  creatine_taken: boolean;
}

export interface RegularFood {
  id: string;
  meal_slot: MealSlot;
  description: string;
  typical_kcal: number | null;
  typical_protein: number | null;
}

export interface PantryItem {
  id: string;
  ingredient: string;
}

/** What the AI (or a suggestion) proposes; the user confirms before it's logged. */
export interface MealDraft {
  title: string;
  items: MealItem[];
  source: MealSource;
  assumptions?: string;
  question?: string | null;
}
