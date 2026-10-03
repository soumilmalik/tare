import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  aiErrorResponse,
  AiError,
  callAi,
  contextBlock,
  EstimateSchema,
  loadUserContext,
  NUTRITION_RULES,
  requireUser,
} from "@/lib/ai";

const Body = z.object({
  images: z.array(z.string().max(2_000_000)).max(4).default([]),
  text: z.string().max(2000).default(""),
  /** For "Re-estimate": the previous estimate plus the user's correction. */
  previous: EstimateSchema.optional(),
  correction: z.string().max(1000).optional(),
});

/** Photo / voice / text → one meal estimate for the confirmation card. */
export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) throw new AiError("That request didn't look right.", 400);
    const { images, text, previous, correction } = parsed.data;
    if (images.length === 0 && !text.trim() && !previous) {
      throw new AiError("Add a photo or describe what you ate.", 400);
    }

    const ctx = await loadUserContext(userId, { pantry: false });
    const content: Anthropic.Beta.BetaContentBlockParam[] = images.map((data) => ({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data },
    }));
    let prompt = text.trim() ? `What I ate: ${text.trim()}` : "Estimate what's in the photo(s).";
    if (previous && correction) {
      prompt += `\n\nYour previous estimate:\n${JSON.stringify(previous)}\nMy correction: ${correction}\nUpdate the estimate.`;
    }
    content.push({ type: "text", text: prompt });

    const estimate = await callAi({
      userId,
      timezone: ctx.timezone,
      dayStartHour: ctx.dayStartHour,
      feature: previous ? "re_estimate" : images.length ? "estimate_photo" : "estimate_text",
      tier: images.length ? "photo" : "text",
      system: `${NUTRITION_RULES}\n\nAbout the user:\n${contextBlock(ctx)}`,
      content,
      schema: EstimateSchema,
    });
    return Response.json(estimate);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
