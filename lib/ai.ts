import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { logicalDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/**
 * The only place that talks to the AI provider (SPEC §4, §12). Photos go to
 * the stronger model, everything else to the cheaper one. Every call is
 * rate-limited, schema-validated (retried once) and logged to ai_usage.
 */

export type Tier = "photo" | "text";
export type Feature = "estimate_photo" | "estimate_text" | "re_estimate" | "suggest" | "hunger" | "ask" | "monthly";

const MODEL: Record<Tier, string> = {
  photo: process.env.AI_MODEL_PHOTO || "claude-sonnet-5-5",
  text: process.env.AI_MODEL_TEXT || "claude-haiku-4-5",
};

// USD per million tokens; override in env if prices change.
const PRICE: Record<Tier, { input: number; output: number }> = {
  photo: {
    input: Number(process.env.AI_PRICE_PHOTO_INPUT_PER_M_USD || 2),
    output: Number(process.env.AI_PRICE_PHOTO_OUTPUT_PER_M_USD || 10),
  },
  text: {
    input: Number(process.env.AI_PRICE_TEXT_INPUT_PER_M_USD || 1),
    output: Number(process.env.AI_PRICE_TEXT_OUTPUT_PER_M_USD || 5),
  },
};
const USD_TO_INR = Number(process.env.USD_TO_INR || 95);
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT_PER_USER || 40);

export class AiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

// --- Schemas -----------------------------------------------------------------

export const ItemSchema = z.object({
  name: z.string(),
  qty: z.string().describe("Indian portion language, e.g. '2 medium rotis', '1 katori', '1 glass (250 ml)'"),
  kcal: z.number(),
  protein: z.number().describe("grams"),
  carbs: z.number().describe("grams"),
  fat: z.number().describe("grams"),
  fibre: z.number().describe("grams"),
});

export const EstimateSchema = z.object({
  title: z.string().describe("Short meal title, e.g. '5 eggs + coffee'"),
  items: z.array(ItemSchema),
  assumptions: z.string().describe("One short line of key assumptions, e.g. 'Assumed 2 medium rotis with ghee'"),
  confidence: z.enum(["low", "medium", "high"]),
  question: z
    .string()
    .nullable()
    .describe("If too unsure to estimate well, ONE short question for the user; otherwise null"),
});
export type Estimate = z.infer<typeof EstimateSchema>;

export const SuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      name: z.string(),
      why: z.string().describe("Why it fits right now, under 15 words"),
      ingredients: z.array(z.string()).describe("At most 6, each with an amount, e.g. '2 eggs'"),
      steps: z.array(z.string()).describe("2–4 steps, each under 12 words"),
      items: z.array(ItemSchema).describe("What would be logged if the user eats this"),
    }),
  ),
});
export type Suggestions = z.infer<typeof SuggestionsSchema>;

export const AnswerSchema = z.object({
  answer: z.string().describe("Direct answer in 1–4 short sentences"),
  meal: EstimateSchema.nullable().describe("If the question describes food the user might log, its estimate; else null"),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const MonthlySchema = z.object({
  text: z.string().describe("3–5 sentences: what improved, one thing to work on, encouraging and specific"),
});

// --- Shared prompt context -------------------------------------------------

export const NUTRITION_RULES = `You are an experienced Indian sports dietitian. Estimate nutrition using Indian food knowledge (IFCT-style values) and Indian portions: 1 roti/chapati ≈ 30 g atta (~80–100 kcal plain, more with ghee), 1 katori ≈ 150 ml, 1 bowl ≈ 250 ml, 1 glass ≈ 250 ml. Home-cooked sabzi/dal usually has 1–2 tsp oil per serving; restaurant food more.
Nutrition labels: if a label is visible, prefer its values over estimates. Read column headers first ("per 100 g" vs "per serving"), match each number to its own row name (protein and carbohydrate are often swapped by mistake - recheck both), use the per-serving column when present, then scale to the portion actually eaten.
Combine all photos and the note: e.g. a pack front identifies the product, the label gives the numbers.
Split the meal into sensible items. Round kcal to whole numbers and macros to 1 decimal.
If a photo is blurry or a description is too vague to estimate sensibly, still give your best estimate, set confidence "low", and ask ONE short question.`;

export interface UserContext {
  dietType: string | null;
  avoid: string | null;
  regularFoods: string[];
  pantry: string[];
  remaining?: { kcal: number; protein: number };
}

export async function loadUserContext(
  userId: string,
  { pantry: withPantry = true }: { pantry?: boolean } = {},
): Promise<UserContext & { timezone: string; dayStartHour: number }> {
  const supabase = await createClient();
  const [profile, foods, pantry] = await Promise.all([
    supabase
      .from("profiles")
      .select("diet_type, allergies_or_avoid, timezone, day_start_hour")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("regular_foods").select("meal_slot, description").limit(15),
    // Only suggestions need the pantry; skipping it keeps estimate prompts small.
    withPantry ? supabase.from("pantry").select("ingredient").limit(40) : Promise.resolve({ data: [] }),
  ]);
  return {
    dietType: profile.data?.diet_type ?? null,
    avoid: profile.data?.allergies_or_avoid ?? null,
    timezone: profile.data?.timezone ?? "Asia/Kolkata",
    dayStartHour: profile.data?.day_start_hour ?? 3,
    regularFoods: (foods.data ?? []).map((f) => `${f.meal_slot}: ${f.description}`),
    pantry: (pantry.data ?? []).map((p) => p.ingredient),
  };
}

export function contextBlock(ctx: UserContext): string {
  const diet = { veg: "vegetarian", egg: "eggetarian", "non-veg": "non-vegetarian" }[ctx.dietType ?? ""] ?? "not specified";
  return [
    `Diet: ${diet}.`,
    ctx.avoid ? `Avoid/allergies: ${ctx.avoid}.` : null,
    ctx.regularFoods.length ? `Usually eats: ${ctx.regularFoods.join("; ")}.` : null,
    ctx.pantry.length ? `Has at home: ${ctx.pantry.join(", ")}.` : null,
    ctx.remaining ? `Left today: ${ctx.remaining.kcal} kcal, ${ctx.remaining.protein} g protein.` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

// --- Auth, limits, logging -------------------------------------------------

export async function requireUser(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) throw new AiError("Please sign in again.", 401);
  return sub;
}

async function checkLimit(timezone: string, dayStartHour: number) {
  const supabase = await createClient();
  const today = logicalDate(new Date(), timezone, dayStartHour);
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase.from("ai_usage").select("created_at").gte("created_at", since);
  const usedToday = (data ?? []).filter((r) => logicalDate(new Date(r.created_at), timezone, dayStartHour) === today).length;
  if (usedToday >= DAILY_LIMIT) {
    const at = new Intl.DateTimeFormat("en-IN", { hour: "numeric", timeZone: "UTC" }).format(Date.UTC(2000, 0, 1, dayStartHour));
    throw new AiError(`You've used today's ${DAILY_LIMIT} AI requests. It resets at ${at}.`, 429);
  }
}

async function logUsage(userId: string, feature: Feature, model: string, tier: Tier, usage: Anthropic.Beta.BetaUsage) {
  const input = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const output = usage.output_tokens;
  const usd = (input * PRICE[tier].input + output * PRICE[tier].output) / 1_000_000;
  const supabase = await createClient();
  await supabase.from("ai_usage").insert({
    user_id: userId,
    feature,
    model,
    input_tokens: input,
    output_tokens: output,
    est_cost_inr: Math.round(usd * USD_TO_INR * 10000) / 10000,
  });
}

// --- The one call ------------------------------------------------------------

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError("AI isn't set up yet (missing API key).", 501);
  client ??= new Anthropic();
  return client;
}

export async function callAi<S extends z.ZodType>({
  userId,
  timezone,
  dayStartHour = 3,
  feature,
  tier,
  system,
  content,
  schema,
  maxTokens = 2000,
}: {
  userId: string;
  timezone: string;
  dayStartHour?: number;
  feature: Feature;
  tier: Tier;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: S;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  await checkLimit(timezone, dayStartHour);
  const model = MODEL[tier];
  const isSonnet55 = model === "claude-sonnet-5-5";

  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await anthropic().beta.messages.parse({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content }],
        output_config: {
          format: betaZodOutputFormat(schema),
          // Sonnet 5.5 always thinks; keep it light. Haiku 4.5 doesn't take effort.
          ...(isSonnet55 ? { effort: "low" as const } : {}),
        },
        // If Sonnet declines for policy reasons, the API retries on a fallback model.
        ...(isSonnet55 ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) throw new AiError("The AI is busy. Try again in a moment.", 503);
      if (err instanceof Anthropic.AuthenticationError) throw new AiError("AI key is invalid. Check ANTHROPIC_API_KEY.", 501);
      if (err instanceof Anthropic.APIConnectionError) throw new AiError("Couldn't reach the AI. Check your internet.", 503);
      if (err instanceof Anthropic.APIError) throw new AiError("The AI had a problem. Try again.", 502);
      throw err;
    }

    await logUsage(userId, feature, response.model, tier, response.usage);

    if (response.stop_reason === "refusal") {
      throw new AiError("The AI couldn't help with that one. Try describing it differently.", 422);
    }
    if (response.parsed_output != null) return response.parsed_output as z.infer<S>;
    // Invalid or cut-off JSON: retry once, then give up politely.
  }
  throw new AiError("The AI's answer didn't come through properly. Please try again.", 502);
}

export function aiErrorResponse(err: unknown) {
  const status = err instanceof AiError ? err.status : 500;
  const message = err instanceof AiError ? err.message : "Something went wrong. Please try again.";
  if (!(err instanceof AiError)) console.error(err);
  return Response.json({ error: message }, { status });
}
