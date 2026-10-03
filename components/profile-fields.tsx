"use client";

import { Choice, Field, inputClass } from "@/components/ui/fields";
import { NumberInput } from "@/components/ui/number-input";
import type { DietType, Profile, Sex, WorkoutType } from "@/lib/types";

/** The answers collected in onboarding, also edited from Profile. */
export type ProfileDraft = Pick<
  Profile,
  | "name"
  | "sex"
  | "age"
  | "height_cm"
  | "weight_kg"
  | "goal_weight_kg"
  | "timeline_weeks"
  | "workout_days_per_week"
  | "workout_type"
  | "workout_minutes"
  | "diet_type"
  | "allergies_or_avoid"
>;

interface Props {
  value: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}

export function BasicsFields({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      <Field label="Name">
        <input
          className={inputClass}
          value={value.name ?? ""}
          autoComplete="given-name"
          placeholder="Your name"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <Field label="Sex" hint="Used for the calorie formula.">
        <Choice<Sex>
          value={value.sex}
          onChange={(sex) => onChange({ sex })}
          options={[
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
          ]}
        />
      </Field>
      <Field label="Age">
        <NumberInput value={value.age} onChange={(age) => onChange({ age })} placeholder="25" />
      </Field>
    </div>
  );
}

export function BodyFields({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Height (cm)">
          <NumberInput value={value.height_cm} onChange={(height_cm) => onChange({ height_cm })} placeholder="165" />
        </Field>
        <Field label="Weight (kg)">
          <NumberInput decimal value={value.weight_kg} onChange={(weight_kg) => onChange({ weight_kg })} placeholder="62" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Goal weight (kg)">
          <NumberInput
            decimal
            value={value.goal_weight_kg}
            onChange={(goal_weight_kg) => onChange({ goal_weight_kg })}
            placeholder="58"
          />
        </Field>
        <Field label="In how many weeks?">
          <NumberInput
            value={value.timeline_weeks}
            onChange={(timeline_weeks) => onChange({ timeline_weeks })}
            placeholder="12"
          />
        </Field>
      </div>
      <p className="text-xs text-text-3">Same as your current weight if you want to maintain.</p>
    </div>
  );
}

export function TrainingFields({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      <Field label="Workouts per week">
        <Choice<string>
          columns={4}
          value={value.workout_days_per_week == null ? null : String(value.workout_days_per_week)}
          onChange={(v) => onChange({ workout_days_per_week: Number(v) })}
          options={["0", "1", "2", "3", "4", "5", "6", "7"].map((v) => ({ value: v, label: v }))}
        />
      </Field>
      <Field label="Mostly">
        <Choice<WorkoutType>
          columns={3}
          value={value.workout_type}
          onChange={(workout_type) => onChange({ workout_type })}
          options={[
            { value: "strength", label: "Strength" },
            { value: "cardio", label: "Cardio" },
            { value: "sports", label: "Sports" },
            { value: "yoga", label: "Yoga" },
            { value: "mixed", label: "Mixed" },
          ]}
        />
      </Field>
      <Field label="Typical session (minutes)">
        <Choice<string>
          columns={5}
          value={value.workout_minutes == null ? null : String(value.workout_minutes)}
          onChange={(v) => onChange({ workout_minutes: Number(v) })}
          options={["30", "45", "60", "75", "90"].map((v) => ({ value: v, label: v }))}
        />
      </Field>
    </div>
  );
}

export function DietFields({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      <Field label="Diet">
        <Choice<DietType>
          columns={3}
          value={value.diet_type}
          onChange={(diet_type) => onChange({ diet_type })}
          options={[
            { value: "veg", label: "Vegetarian" },
            { value: "egg", label: "Eggetarian" },
            { value: "non-veg", label: "Non-veg" },
          ]}
        />
      </Field>
      <Field label="Foods to avoid or allergies" hint="Optional. e.g. peanuts, mushrooms, no beef">
        <textarea
          rows={3}
          className={`${inputClass} h-auto py-3`}
          value={value.allergies_or_avoid ?? ""}
          onChange={(e) => onChange({ allergies_or_avoid: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function draftFromProfile(p: Profile | null): ProfileDraft {
  return {
    name: p?.name ?? null,
    sex: p?.sex ?? null,
    age: p?.age ?? null,
    height_cm: p?.height_cm == null ? null : Number(p.height_cm),
    weight_kg: p?.weight_kg == null ? null : Number(p.weight_kg),
    goal_weight_kg: p?.goal_weight_kg == null ? null : Number(p.goal_weight_kg),
    timeline_weeks: p?.timeline_weeks ?? null,
    workout_days_per_week: p?.workout_days_per_week ?? null,
    workout_type: p?.workout_type ?? null,
    workout_minutes: p?.workout_minutes ?? null,
    diet_type: p?.diet_type ?? null,
    allergies_or_avoid: p?.allergies_or_avoid ?? null,
  };
}

/** Plain-language problem with a step's answers, or null if they're fine. */
export function validate(step: "basics" | "body" | "training" | "diet", v: ProfileDraft): string | null {
  if (step === "basics") {
    if (!v.name?.trim()) return "Add your name.";
    if (!v.sex) return "Choose your sex.";
    if (!v.age || v.age < 13 || v.age > 90) return "Enter an age between 13 and 90.";
  }
  if (step === "body") {
    if (!v.height_cm || v.height_cm < 120 || v.height_cm > 230) return "Enter your height in cm (120–230).";
    if (!v.weight_kg || v.weight_kg < 30 || v.weight_kg > 250) return "Enter your weight in kg.";
    if (!v.goal_weight_kg || v.goal_weight_kg < 30 || v.goal_weight_kg > 250) return "Enter a goal weight in kg.";
    if (!v.timeline_weeks || v.timeline_weeks < 1 || v.timeline_weeks > 260) return "Enter a timeline in weeks.";
  }
  if (step === "training") {
    if (v.workout_days_per_week == null) return "Choose how often you work out.";
    if (!v.workout_type) return "Choose your main type of training.";
    if (v.workout_minutes == null) return "Choose a typical session length.";
  }
  if (step === "diet" && !v.diet_type) return "Choose your diet.";
  return null;
}
