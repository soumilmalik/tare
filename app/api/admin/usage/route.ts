import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** AI calls and estimated cost per user per month. Only for ADMIN_EMAIL. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = String(data?.claims?.email ?? "").toLowerCase();
  const admin = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
  if (!admin || email !== admin) return Response.json({ error: "Not allowed" }, { status: 403 });

  const db = createAdminClient();
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5, 1)).toISOString();
  const [{ data: rows }, { data: users }] = await Promise.all([
    db.from("ai_usage").select("user_id, created_at, est_cost_inr").gte("created_at", since).limit(50000),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emails = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? u.id]));
  const byKey = new Map<string, { email: string; month: string; calls: number; inr: number }>();
  for (const r of rows ?? []) {
    const month = r.created_at.slice(0, 7);
    const key = `${r.user_id}|${month}`;
    const row = byKey.get(key) ?? { email: emails.get(r.user_id) ?? r.user_id, month, calls: 0, inr: 0 };
    row.calls++;
    row.inr += Number(r.est_cost_inr);
    byKey.set(key, row);
  }
  const usage = [...byKey.values()]
    .map((r) => ({ ...r, inr: Math.round(r.inr * 100) / 100 }))
    .sort((a, b) => b.month.localeCompare(a.month) || b.inr - a.inr);
  return Response.json({ usage });
}
