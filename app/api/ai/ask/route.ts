import { z } from "zod";
import {
  aiErrorResponse,
  AiError,
  AnswerSchema,
  callAi,
  contextBlock,
  loadUserContext,
  NUTRITION_RULES,
  requireUser,
} from "@/lib/ai";

const Body = z.object({
  question: z.string().min(2).max(500),
  remaining: z.object({ kcal: z.number(), protein: z.number() }).optional(),
});

/** "Ask AI" from global search: short nutrition answers, with a loggable estimate when relevant. */
export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) throw new AiError("Ask a question about food or nutrition.", 400);
    const ctx = await loadUserContext(userId);

    const result = await callAi({
      userId,
      timezone: ctx.timezone,
      feature: "ask",
      tier: "text",
      system: `${NUTRITION_RULES}
Answer the user's food/nutrition question briefly and practically. If they describe food they might eat or log, also return its estimate in "meal"; otherwise meal is null. Only answer food, nutrition, training and hydration questions.

About the user:
${contextBlock({ ...ctx, remaining: parsed.data.remaining })}`,
      content: [{ type: "text", text: parsed.data.question }],
      schema: AnswerSchema,
    });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
