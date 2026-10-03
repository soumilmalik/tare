import webpush from "web-push";
import { logicalDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { lowWaterMl } from "@/lib/targets";

/**
 * Runs every 15 minutes (Supabase pg_cron → this URL). Sends each due reminder
 * at most once per logical day (SPEC §11).
 */

const WINDOW_MINUTES = 90; // still send if the job runs a little late

function localMinutes(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function isDue(nowMin: number, at: string) {
  const diff = nowMin - toMinutes(at);
  return diff >= 0 && diff < WINDOW_MINUTES;
}

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv } = process.env;
  if (!pub || !priv) return Response.json({ error: "VAPID keys missing" }, { status: 501 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);

  const db = createAdminClient();
  const { data: subs } = await db.from("push_subscriptions").select("id, user_id, subscription");
  if (!subs?.length) return Response.json({ sent: 0 });

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: profiles } = await db
    .from("profiles")
    .select(
      "user_id, timezone, day_start_hour, target_water_ml, takes_creatine, notify_water, water_reminder_time, notify_creatine, creatine_reminder_time, notify_meal_nudge",
    )
    .in("user_id", userIds);

  const now = new Date();
  let sent = 0;

  for (const p of profiles ?? []) {
    const tz = p.timezone || "Asia/Kolkata";
    const today = logicalDate(now, tz, p.day_start_hour ?? 3);
    const nowMin = localMinutes(now, tz);
    const { data: day } = await db
      .from("daily_summary")
      .select("kcal, water_ml, creatine_taken")
      .eq("user_id", p.user_id)
      .eq("logical_date", today)
      .maybeSingle();

    const due: { kind: "water" | "creatine" | "meal"; body: string }[] = [];
    const water = day?.water_ml ?? 0;
    const waterFloor = lowWaterMl(p.target_water_ml);
    if (p.notify_water && isDue(nowMin, p.water_reminder_time) && water < waterFloor) {
      due.push({ kind: "water", body: "Water is low today — finish your intake." });
    }
    if (p.takes_creatine && p.notify_creatine && isDue(nowMin, p.creatine_reminder_time) && !day?.creatine_taken) {
      due.push({ kind: "creatine", body: "Don't forget your 3 g of creatine today." });
    }
    if (p.notify_meal_nudge && isDue(nowMin, "14:00") && !(day?.kcal ?? 0)) {
      due.push({ kind: "meal", body: "Nothing logged yet today. Add what you've eaten." });
    }

    for (const reminder of due) {
      // Claim the reminder first so a parallel or repeated run can't send it twice.
      const claim = await db
        .from("reminder_log")
        .insert({ user_id: p.user_id, logical_date: today, kind: reminder.kind });
      if (claim.error) continue;

      for (const s of subs.filter((x) => x.user_id === p.user_id)) {
        try {
          await webpush.sendNotification(
            s.subscription,
            JSON.stringify({ title: "Tare", body: reminder.body, url: "/" }),
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // The phone unsubscribed or the app was removed: forget this device.
          if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
          else console.error("Push failed", status);
        }
      }
    }
  }

  return Response.json({ sent });
}
