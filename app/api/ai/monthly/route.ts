import { z } from "zod";
import { aiErrorResponse, AiError, callAi, loadUserContext, MonthlySchema, requireUser } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({ month: z.string().regex(/^\d{4}-\d{2}-01$/) });

/**
 * Writes the short summary of a finished month, once. Cached in
 * monthly_summaries so it's one AI call per user per month.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) throw new AiError("Bad month.", 400);
    const { month } = parsed.data;
    const supabase = await createClient();

    const cached = await supabase.from("monthly_summaries").select("text").eq("month", month).maybeSingle();
    if (cached.data) return Response.json({ text: cached.data.text });

    const start = new Date(`${month}T00:00:00Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    if (end > new Date()) throw new AiError("This month isn't over yet.", 400);
    const prevStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const [profile, days] = await Promise.all([
      supabase.from("profiles").select("target_kcal, target_protein_g, target_water_ml").eq("user_id", userId).single(),
      supabase
        .from("daily_summary")
        .select("logical_date, kcal, protein_g, water_ml, creatine_taken")
        .gte("logical_date", iso(prevStart))
        .lt("logical_date", iso(end)),
    ]);
    const rows = days.data ?? [];
    const thisMonth = rows.filter((r) => r.logical_date >= month && r.kcal > 0);
    if (thisMonth.length < 3) throw new AiError("Not enough logged days last month for a summary.", 404);
    const lastMonth = rows.filter((r) => r.logical_date < month && r.kcal > 0);

    const stats = (list: typeof rows) => {
      const t = profile.data;
      const n = list.length || 1;
      return {
        logged_days: list.length,
        avg_kcal: Math.round(list.reduce((s, r) => s + r.kcal, 0) / n),
        avg_protein_g: Math.round(list.reduce((s, r) => s + Number(r.protein_g), 0) / n),
        avg_water_ml: Math.round(list.reduce((s, r) => s + r.water_ml, 0) / n),
        protein_target_hit_pct: t?.target_protein_g
          ? Math.round((100 * list.filter((r) => Number(r.protein_g) >= t.target_protein_g!).length) / n)
          : null,
        water_target_hit_pct: t?.target_water_ml
          ? Math.round((100 * list.filter((r) => r.water_ml >= t.target_water_ml!).length) / n)
          : null,
      };
    };

    const ctx = await loadUserContext(userId);
    const result = await callAi({
      userId,
      timezone: ctx.timezone,
      feature: "monthly",
      tier: "text",
      system:
        "You are the user's supportive, no-nonsense nutrition coach. Write a short monthly review from the stats: what improved, and ONE concrete thing to work on next month. Plain language, no headings, no emojis.",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            targets: profile.data,
            this_month: stats(thisMonth),
            previous_month: lastMonth.length ? stats(lastMonth) : null,
          }),
        },
      ],
      schema: MonthlySchema,
      maxTokens: 800,
    });

    await supabase.from("monthly_summaries").insert({ user_id: userId, month, text: result.text });
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
