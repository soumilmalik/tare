import type { Sex, WorkoutType } from "@/lib/types";

/**
 * Daily calorie, protein and water targets (SPEC §6). Deterministic coaching
 * maths, no AI: Mifflin–St Jeor BMR, a light-activity baseline plus the
 * user's actual training volume, then a goal adjustment with safety caps.
 */

export interface TargetInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  timelineWeeks: number;
  workoutDaysPerWeek: number;
  workoutType: WorkoutType;
  workoutMinutes: number;
}

export interface Targets {
  kcal: number;
  proteinG: number;
  waterMl: number;
  glasses: number;
  explain: { kcal: string; protein: string; water: string };
  /** Set when the requested timeline isn't safe; we use the safe number instead. */
  timelineNote: string | null;
}

const KCAL_PER_KG = 7700;
// Net extra energy of training above resting, as METs minus 1.
const TRAINING_MET: Record<WorkoutType, number> = {
  strength: 5,
  cardio: 7,
  sports: 7,
  mixed: 6,
  yoga: 2.5,
};
const MAX_WEEKLY_LOSS_PCT = 0.008; // 0.8% of bodyweight per week
const MAX_DEFICIT_PCT = 0.25;
const MAX_WEEKLY_GAIN_PCT = 0.005; // lean gain: ~0.5% per week at most
const MIN_SURPLUS_PCT = 0.05;
const MAX_SURPLUS_PCT = 0.15;
const KCAL_FLOOR: Record<Sex, number> = { female: 1200, male: 1500 };

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function bmr({ sex, age, heightCm, weightKg }: TargetInput): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

/** Maintenance calories: BMR × 1.3 for everyday life, plus averaged training. */
export function tdee(input: TargetInput): number {
  const base = bmr(input) * 1.3;
  const kcalPerMinute = ((TRAINING_MET[input.workoutType] - 1) * 3.5 * input.weightKg) / 200;
  const weeklyTraining = input.workoutDaysPerWeek * input.workoutMinutes * kcalPerMinute;
  return base + weeklyTraining / 7;
}

export function calculateTargets(input: TargetInput): Targets {
  const maintenance = tdee(input);
  const diff = input.goalWeightKg - input.weightKg;
  const weeks = Math.max(1, input.timelineWeeks);
  let kcal = maintenance;
  let goalLine = "to maintain your weight";
  let timelineNote: string | null = null;

  if (diff <= -1) {
    const requestedWeekly = -diff / weeks;
    const safeWeekly = Math.min(
      input.weightKg * MAX_WEEKLY_LOSS_PCT,
      (maintenance * MAX_DEFICIT_PCT * 7) / KCAL_PER_KG,
    );
    const weekly = Math.min(requestedWeekly, safeWeekly);
    kcal = Math.max(maintenance - (weekly * KCAL_PER_KG) / 7, KCAL_FLOOR[input.sex]);
    const actualWeekly = ((maintenance - kcal) * 7) / KCAL_PER_KG;
    goalLine = `to lose about ${actualWeekly.toFixed(1)} kg a week`;
    if (requestedWeekly > actualWeekly + 0.05) {
      const realistic = Math.ceil(-diff / actualWeekly);
      timelineNote = `Losing ${(-diff).toFixed(0)} kg in ${weeks} weeks is faster than is safe to keep muscle. About ${realistic} weeks is realistic, so these targets use the safe pace.`;
    }
  } else if (diff >= 1) {
    const requestedWeekly = diff / weeks;
    const maxWeekly = input.weightKg * MAX_WEEKLY_GAIN_PCT;
    const weekly = Math.min(requestedWeekly, maxWeekly);
    const surplus = Math.min(
      Math.max((weekly * KCAL_PER_KG) / 7, maintenance * MIN_SURPLUS_PCT),
      maintenance * MAX_SURPLUS_PCT,
    );
    kcal = maintenance + surplus;
    goalLine = `for a lean gain of about ${weekly.toFixed(2)} kg a week`;
    if (requestedWeekly > maxWeekly + 0.02) {
      const realistic = Math.ceil(diff / maxWeekly);
      timelineNote = `Gaining ${diff.toFixed(0)} kg in ${weeks} weeks would add mostly fat. About ${realistic} weeks is realistic for lean gain, so these targets use that pace.`;
    }
  }

  // Protein: per kg of a reference weight. If BMI is over 30, use the goal
  // weight (or BMI-27 weight) so the number isn't inflated by body fat.
  const heightM = input.heightCm / 100;
  const bmi = input.weightKg / (heightM * heightM);
  const refWeight =
    bmi > 30 ? Math.max(input.goalWeightKg, 27 * heightM * heightM) : input.weightKg;
  const lifts = input.workoutType === "strength" || input.workoutType === "mixed";
  const perKg =
    diff <= -1 ? (lifts ? 2.2 : 1.8) : diff >= 1 ? (lifts ? 2.0 : 1.8) : lifts ? 1.8 : 1.6;
  const proteinG = roundTo(refWeight * perKg, 5);

  const trains = input.workoutDaysPerWeek > 0 && input.workoutMinutes > 0;
  const waterMl = Math.max(1500, roundTo(input.weightKg * 35 + (trains ? 500 : 0), 250));

  const finalKcal = roundTo(kcal, 50);
  return {
    kcal: finalKcal,
    proteinG,
    waterMl,
    glasses: Math.round(waterMl / 250),
    explain: {
      kcal: `Your maintenance is about ${roundTo(maintenance, 50)} kcal; this is set ${goalLine}.`,
      protein: `${perKg} g per kg${bmi > 30 ? " of a healthy reference weight" : " of bodyweight"}${lifts ? " to support your training" : ""}.`,
      water: `About 35 ml per kg${trains ? ", plus 500 ml for training" : ""}: ${Math.round(waterMl / 250)} glasses.`,
    },
    timelineNote,
  };
}

/** Builds TargetInput from a profile row, or null if anything needed is missing. */
export function targetInputFromProfile(p: {
  sex: Sex | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal_weight_kg: number | null;
  timeline_weeks: number | null;
  workout_days_per_week: number | null;
  workout_type: WorkoutType | null;
  workout_minutes: number | null;
}): TargetInput | null {
  if (!p.sex || !p.age || !p.height_cm || !p.weight_kg || !p.workout_type) return null;
  return {
    sex: p.sex,
    age: p.age,
    heightCm: Number(p.height_cm),
    weightKg: Number(p.weight_kg),
    goalWeightKg: Number(p.goal_weight_kg ?? p.weight_kg),
    timelineWeeks: p.timeline_weeks ?? 12,
    workoutDaysPerWeek: p.workout_days_per_week ?? 0,
    workoutType: p.workout_type,
    workoutMinutes: p.workout_minutes ?? 0,
  };
}

/** Water below this by the reminder time triggers the low-water reminder (SPEC §11). */
export function lowWaterMl(targetWaterMl: number | null | undefined) {
  return Math.max(1500, Math.round((0.75 * (targetWaterMl ?? 2000)) / 50) * 50);
}
