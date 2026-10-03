import { z } from "zod";
import {
  aiErrorResponse,
  AiError,
  callAi,
  contextBlock,
  loadUserContext,
  requireUser,
  SuggestionsSchema,
} from "@/lib/ai";

const Body = z.object({
  slot: z.enum(["breakfast", "lunch", "evening snack", "dinner", "late snack"]),
  remaining: z.object({ kcal: z.number(), protein: z.number() }),
  hunger: z.enum(["a bit", "moderate", "very"]).nullable().default(null),
  note: z.string().max(500).default(""),
});

/** "What should I eat next?" — 3 options that fit what's left today. */
export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) throw new AiError("That request didn't look right.", 400);
    const { slot, remaining, hunger, note } = parsed.data;
    const ctx = await loadUserContext(userId);

    const system = `You are an experienced Indian sports dietitian suggesting the user's next meal.
Rules:
- Suggest exactly 3 options for ${slot} that fit within what's left today (never more than the kcal left; if little is left, suggest light, high-protein options).
- Build mainly from the user's usual meals and foods, then similar alternatives they don't usually have. Prefer ingredients they have at home.
- Strictly respect their diet and foods to avoid.
- Use Indian portions (roti, katori, bowl, glass) and realistic Indian home cooking.
- Each option: short name, a reason under 15 words, at most 6 ingredients with amounts, 2–4 very short steps, and the items as they'd be logged (with kcal and macros). Be brief everywhere.

About the user:
${contextBlock({ ...ctx, remaining })}`;

    const ask = hunger
      ? `I'm ${hunger === "very" ? "very hungry" : hunger === "a bit" ? "a bit hungry" : "moderately hungry"}.${
          hunger === "very" ? " Prioritise filling, high-volume, high-protein options." : ""
        }${note ? ` ${note}` : ""}`
      : `Suggest my ${slot}.${note ? ` ${note}` : ""}`;

    const result = await callAi({
      userId,
      timezone: ctx.timezone,
      dayStartHour: ctx.dayStartHour,
      feature: hunger ? "hunger" : "suggest",
      tier: "text",
      system,
      content: [{ type: "text", text: ask }],
      schema: SuggestionsSchema,
      maxTokens: 3000,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
