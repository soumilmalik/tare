# SPEC — Calorie, Protein & Water Tracker (PWA)

> **How to use this file (for the project owner, not the agent):**
> 1. Create an empty project folder. Put this file in it as `SPEC.md`.
> 2. Create `reference/` inside it and save:
>    - your hand-drawn sketch as `reference/home-sketch.png`
>    - each UI component as its own file in `reference/components/` (`AnimatedList.jsx`, `AnimatedList.css`, `SmoothTab.tsx`, `ActionSearchBar.tsx`, `AIVoice.tsx`, `ParticleButton.tsx`, `CardFlip.tsx`, `ActivityRings.tsx`)
> 3. Open Claude Code (or Codex) in that folder and send: **"Read SPEC.md and everything in /reference. Start Phase 1 only. Ask me anything unclear before writing code."**
> 4. After each phase, test on your phone, then say "Start Phase N". Building phase by phase uses far fewer credits than one giant run.
> 5. Use Claude Code as the main builder; use Codex to review a phase or when Claude Code limits run out.

---

## 1. Your role

You are a senior full-stack developer who is also an experienced sports dietitian and strength coach. You have coached elite athletes, film actors and competitive bodybuilders, including many Indian clients, so you understand Indian foods, portion sizes (katori, roti, bowl, glass) and Indian vegetarian, eggetarian and non-vegetarian diets in depth.

Build this app as both: clean, fast, production-quality code, and nutrition logic a top coach would sign off on.

## 2. Product summary

A minimal, very fast tracker for **calories, protein and water**, installed on iPhone as a **PWA** (Add to Home Screen). Built on Windows; no Mac, no App Store.

- Users: initially two, but **multi-user from day one** so I can share it with others later.
- Three bottom tabs: **AI Meals (left) · Home (middle, default) · Profile (right)**.
- AI is used **only where it adds real value**: photo/voice/text meal estimation, meal suggestions, global search answers, monthly summary. Everything else (water, creatine, manual entry, history, charts) uses **zero AI calls**.
- AI must never feel forced: no chat bubbles on screens that don't need them, no AI prompts popping up unasked.

## 3. Non-negotiables

1. **Speed:** home screen interactive in under 1 second on a mid-range iPhone. Water, creatine and manual logs update the UI instantly (optimistic updates), then sync.
2. **Minimal:** pure black background, white and grey text, generous spacing, nothing cluttered. Think of Claude's interface, but with `#000000` instead of grey.
3. **Every AI estimate is confirmed by the user before it is logged** (see §7.3).
4. **Lightweight storage:** never store photos; store text and numbers only.
5. **Smooth animations:** 60fps, transform/opacity only, respect `prefers-reduced-motion`.
6. **Indian context:** Indian foods, Indian portion language, IST by default, kcal and grams, ml for water.

## 4. Tech stack & architecture

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + `motion` | The reference components are written for this stack |
| PWA | Serwist (or next-pwa successor), web app manifest, standalone display, app icons | Installable, full-screen, offline shell |
| Auth + DB | Supabase (Postgres + Auth + Row Level Security) | Free tier, multi-user, per-user data isolation |
| AI | Google Gemini **Flash** model via server-side API route | Cheapest capable vision + audio model; free tier to start |
| Hosting | Vercel (free tier) | Free, deploys from GitHub |
| Push | Web Push (VAPID) via a scheduled server job | iOS supports push for home-screen PWAs (iOS 16.4+) |

Rules:
- **API keys only on the server** (Next.js route handlers). Never in client code.
- Model name lives in an env var (`AI_MODEL`) so it can be swapped. Check Google AI Studio docs for the current Flash model name; don't hard-code a guess.
- Keep the AI provider behind one small module (`lib/ai.ts`) so it can be switched to Claude Haiku or GPT-mini later without touching the UI.
- **Auth: email + 6-digit OTP code**, not magic links. Magic links open in Safari, not the installed PWA, and the session gets lost.
- Force dark mode (`class="dark"` on `<html>`) — the components use `dark:` variants.
- Offline: water, creatine and manual entries work offline and queue for sync. AI features show "needs internet" when offline.
- Keep the bundle small: no heavy chart or date libraries. Hand-rolled SVG charts are fine; use native `Intl` for dates.

## 5. Data model (Supabase, RLS on every table: users see only their own rows)

- `profiles`: user_id, name, sex, age, height_cm, weight_kg, goal_weight_kg, timeline_weeks, activity (frequency + type), diet_type (veg / egg / non-veg), allergies_or_avoid (text), takes_creatine (bool), targets (kcal, protein_g, water_ml — **editable**), timezone (default Asia/Kolkata), notification prefs, created_at.
- `regular_foods`: user_id, meal_slot (breakfast / lunch / dinner / snack / regular item), description, typical kcal, typical protein.
- `pantry`: user_id, ingredient (ingredients usually at home; editable list).
- `meal_logs`: id, user_id, logical_date, logged_at, title, items (JSON: name, qty, kcal, protein, carbs, fat, fibre), total_kcal, total_protein, source (photo / voice / text / manual), user_edited (bool), deleted_at (soft delete for undo).
- `daily_summary`: user_id, logical_date, kcal, protein_g, water_ml, creatine_taken (bool). **One tiny row per day** — this powers History and Insights cheaply.
- `water_logs`: user_id, logical_date, ml (+250 or −250), logged_at. **Not shown in the meal list.**
- `monthly_summaries`: user_id, month, text (cached AI summary).
- `ai_usage`: user_id, feature, input_tokens, output_tokens, est_cost_inr, created_at — **so I can see what each user costs per month.**
- `push_subscriptions`: user_id, subscription JSON.

**Logical day:** the day resets at **3:00 AM** in the user's timezone. `logical_date = date(now_in_user_tz − 3 hours)`. Use this everywhere (logs, summaries, reminders).

Carbs, fat and fibre are stored quietly from AI estimates but **not shown on Home** (could appear later in Insights).

## 6. Onboarding (first launch, after sign-in)

A short, calm, step-by-step flow (one question per screen, progress dots, back button):

1. Name, sex, age.
2. Height, current weight, goal weight, timeline.
3. Workout frequency (days/week) and type (strength / cardio / sports / yoga / mixed) and typical duration.
4. Diet type: vegetarian / eggetarian / non-vegetarian; foods to avoid or allergies.
5. Typical meals: breakfast, lunch, dinner, snacks — free text per slot (voice input allowed). Then "Other things you eat regularly" (e.g. Yoga Bar, bananas, peanut butter, rice cakes).
6. Ingredients usually at home (chips to add/remove).
7. Do you take creatine? (yes/no)
8. Notifications permission (explain why in one line; skippable).
9. **Your targets** screen: shows calculated kcal, protein and water with a one-line explanation each. **All three editable.** Confirm → Home.

### Target calculation (coach-grade, deterministic — no AI call)
- BMR: Mifflin–St Jeor. TDEE = BMR × activity multiplier from frequency/type.
- Goal adjustment from (goal − current weight) / timeline. **Safety caps:** fat loss ≤ ~0.75–1% bodyweight/week, deficit ≤ ~25% of TDEE, never below a sensible floor (~1200 kcal women / ~1500 kcal men); muscle gain surplus ~5–15%. If the timeline is unrealistic, show a gentle note with a realistic timeline and use the safe number.
- Protein: 1.6–2.2 g/kg (higher end for fat loss + strength training), using goal weight if the person is significantly overweight. Round to nearest 5 g.
- Water: ~35 ml/kg + ~500 ml on training days, rounded to the nearest 250 ml. Glass count = water target ÷ 250.
- Recalculate suggestion (not auto-apply) when weight is updated in Profile.

## 7. Home tab (match `reference/home-sketch.png`)

Top to bottom:

### 7.1 Progress header
Three compact stats: **Protein 53 / 100 g · Calories 1250 / 2500 kcal · Water 1500 / 2000 ml**. Use the **Activity Rings** component, restyled monochrome (white / light grey / mid grey on dark grey tracks), with the numbers beside or below. Rings animate smoothly when values change. Over-target values show clearly but without alarm colours.

### 7.2 Creatine button (top right, under the header)
- Small circular scoop icon. **Default: black fill, white border, white icon. Logged: white (or light grey) fill, black icon.**
- Tap → logs 3 g creatine + 250 ml water. Only once per logical day; tapping again asks "Undo creatine?".
- Only shown if the user takes creatine (toggle in Profile).
- **Low-water warning:** after logging, if total water for the day is still **below 1500 ml**, show a quick modal: **"Extremely low water intake — complete your water intake ASAP."** Dismiss with one tap.

### 7.3 Water button (centre)
- Large circular glass button, **+250 ml** per tap, with the **Particle Button** effect on tap and a short haptic where supported.
- Counter beside it: **(2/8)** = glasses done / glasses target.
- Small **"−"** next to the counter removes 250 ml (never below 0).
- Water logs never appear in the meal list.

### 7.4 Manual entry
Two pill buttons side by side: **Calories +** and **Protein +**. Tap → a small inline numeric input slides open (number keypad), enter value, confirm. Logs as a manual entry in the meal list (title "Manual calories" / "Manual protein", editable).

### 7.5 Today's meals
- List of today's logged meals: **title, kcal, protein, time** (e.g. "5 eggs + coffee · 380 kcal · 32 g · 8:15").
- Use **AnimatedList** for entrance animations.
- **Swipe left to delete → undo snackbar for 5 seconds** (soft delete; hard delete after the snackbar closes).
- Tap a meal → edit sheet (same as the confirmation card).
- Empty state: one quiet grey line, e.g. "Nothing logged yet".

### 7.6 Input bar (bottom, above the tab bar)
Three buttons: **Mic (left) · Camera (centre, large) · Chat (right).**

**Camera flow**
- Opens the camera (`<input type="file" accept="image/*" capture="environment">`, plus pick from gallery). **Multiple photos per entry** (e.g. protein bar front + nutrition label; meal + salad). Thumbnails with remove (×) and "+ add another".
- Optional note field under the photos, with a mic button to dictate into it (e.g. "milk has 1 scoop whey and a banana").
- **Compress on device before upload:** longest side ~1024 px, JPEG ~0.7 quality. Send all photos + note in **one** AI request. Never store photos.
- If a nutrition label is visible, read it and prefer label values.

**Voice flow (mic)**
- Uses the **AI Voice** component UI (timer, waveform, "Listening…").
- Record with `MediaRecorder` (iOS Safari records mp4/aac). Send the audio to the AI in **one call that both transcribes and estimates**. Do not use the browser SpeechRecognition API (unreliable in iOS home-screen apps).
- Waveform should react to real mic levels (Web Audio analyser), not random heights.

**Chat flow**
- Opens a simple text input sheet: "What did you eat?" Type freely, send.

**Confirmation card (all three flows end here — mandatory)**
- Shows the AI's estimate: each detected item with quantity, kcal and protein, plus totals and a meal title.
- **Every number, quantity and the title is editable.** Items can be added or removed.
- Optional "Re-estimate" box: add a correction note → one more AI call.
- **Log** button saves; **Cancel** discards. Nothing is saved before Log.
- If the AI is unsure (blurry photo, vague text), it says so in one line and asks one short question instead of guessing wildly.

## 8. AI Meals tab (left)

Purpose: what should I eat next?

- Top: remaining for today — "1,050 kcal · 47 g protein left" — and time of day.
- **Suggestions** for the next meal slot (based on the current time) that fit the remaining budget:
  - Primarily built from the user's **regular meals and regular foods**, then **similar alternatives** they don't usually have.
  - Respect diet type, foods to avoid, and the **pantry** ("what I have at home").
  - Each suggestion: name, kcal, protein, one-line why, short recipe. Use **CardFlip** (front: name + kcal/protein; back: ingredients + steps). On mobile, flip on **tap**, not hover.
  - "Log this" on a suggestion → opens the confirmation card pre-filled (no extra AI call).
- **"How hungry are you?"**: three chips (a bit / moderate / very hungry) plus an optional text/voice note → tailored options within the remaining budget (e.g. very hungry + low kcal left → high-volume, high-protein options).
- **Pantry editor**: quick add/remove of ingredients at home.
- Cache suggestions until something changes (new log, pantry edit, hunger request), so reopening the tab does **not** call the AI again.

## 9. Profile tab (right)

Top to bottom:
1. Personal details (all onboarding answers), editable. Changing weight/goal/activity → offer recalculated targets.
2. Targets (kcal, protein, water) — editable directly.
3. Regular meals & foods, pantry, diet type, creatine on/off.
4. Notifications & reminders toggles and times.
5. **Insights**
   - Simple charts (hand-rolled SVG): daily kcal vs target, protein vs target, water vs target — toggle 7 days / 30 days / all time. Also weight trend if weight is updated.
   - Simple stats: % of days protein target hit, average kcal, streaks, this month vs last month, since the beginning.
   - **Monthly summary:** a short AI-written summary of the previous month (what improved, one thing to work on), generated once on the first app open after a month ends, cached in `monthly_summaries`. One AI call per user per month.
6. **Export data:** CSV download (daily summaries + meal logs).
7. **Usage & cost** (visible to me as admin; my email set in an env var): AI calls and estimated INR cost per user per month, from `ai_usage`.
8. Sign out.
9. **History** — at the very bottom, quiet and collapsed by default: a scrollable list of past days (date · kcal · protein · water · creatine ✓), at least the last 30 days, tap a day to see its meals. Reads only from `daily_summary` until a day is opened.

## 10. Global search (AI bar)

- Use the **ActionSearchBar** component, opened from a search icon in the top area of each tab (and by pulling down on Home).
- Searches **everywhere**, locally first and instantly: past meals, regular foods, pantry, history days, settings, actions (e.g. "add water", "log creatine", "export").
- If the query is a question ("how much protein in 2 rotis and dal?", "what can I eat for 400 kcal?"), the last result is **"Ask AI"** → one AI call, answer shown inline, with "Log this" when relevant.

## 11. Notifications & reminders (Web Push, all toggleable)

- **Evening water reminder:** at 8:00 PM (user-adjustable) if water for the day is below 1500 ml (or below 75% of target, whichever is higher). Text: "Water is low today — finish your intake."
- **Creatine reminder:** at a user-set time if creatine isn't logged (only for creatine users).
- **Meal log nudge (optional, off by default):** if nothing is logged by 2:00 PM.
- A scheduled server job (Vercel Cron or Supabase scheduled function) runs these checks. Respect the 3 AM logical day.
- If push isn't enabled, explain in Profile how to enable it (app must be added to the Home Screen first).

## 12. AI usage rules (cost control)

- Only these features call AI: photo/voice/text estimation, re-estimate, suggestions, hunger request, "Ask AI" in search, monthly summary.
- All AI responses must be **structured JSON** validated with a schema (zod); retry once on invalid JSON, then show a friendly error.
- Short system prompts; send only needed context (today's remaining macros, diet type, regular foods, pantry — not full history).
- Use Indian nutrition knowledge (IFCT-style values) and Indian portion sizes; state assumptions briefly (e.g. "assumed 2 medium rotis with ghee").
- **Rate limit:** max 40 AI calls per user per day (env var). Friendly message when hit.
- Log every call to `ai_usage` with token counts and estimated INR cost (price per token and USD→INR rate in env vars).

## 13. Design system

- Background `#000000`. Surfaces `#0F0F0F` / `#171717`. Borders `#262626`. Primary text `#FFFFFF`, secondary `#A3A3A3`, tertiary `#525252`.
- **No accent colours.** Monochrome everywhere (the creatine logged state is white/grey, not green).
- Font: Inter (or the system font stack). Numbers tabular.
- Rounded corners 12–16 px, thin borders, no heavy shadows.
- Motion: 150–300 ms, ease-out, springs for tab indicator; no bouncy or flashy effects.
- Respect iPhone safe areas (notch, home indicator). Prevent zoom on input focus (16 px inputs). Disable pull-to-refresh bounce where it fights gestures.
- Touch targets ≥ 44 px. Accessible labels on icon buttons.

## 14. Reference components — where they go and required fixes

All files are in `reference/components/`. Adapt them; don't paste blindly.

| Component | Used for | Required changes |
|---|---|---|
| **SmoothTab** | Bottom tab bar (3 tabs) with sliding indicator and sliding content | 3 columns not 4; full width, not `w-[400px]`; monochrome (remove blue/purple/emerald/amber); icons for AI Meals / Home / Profile; content area = full tab screens; Home is default |
| **ActionSearchBar** | Global search (§10) | Replace sample actions with real search results + "Ask AI"; remove ⌘K text (mobile) |
| **AI Voice** | Mic recording UI (§7.6) | Remove demo mode; drive by real recording state; waveform from real audio levels; monochrome |
| **ParticleButton** | Water +250 ml button | **Bug:** its `handleClick` never calls the `onClick` prop — fix so the action runs; remove the mouse-pointer icon; particles white |
| **AnimatedList** | Today's meals list | Disable `enableArrowNavigation` (its window-level Tab/Arrow handler breaks inputs and accessibility); remove hover selection; add swipe-to-delete; render structured rows (title, kcal, protein, time), not plain strings; use a stable key (meal id), not index; colours → design system |
| **Activity Rings** | Progress header (§7.1) | Take real values as props; monochrome; smaller size for the header; remove hard-coded MOVE/EXERCISE/STAND |
| **CardFlip** | Meal suggestions (§8) | Flip on tap; remove orange accents; content from suggestion data; remove "Start today" → "Log this" |

## 15. Build phases (stop after each phase and wait for me)

1. **Foundation:** Next.js + Tailwind + shadcn + PWA manifest/icons + Supabase auth (email OTP) + DB schema with RLS + 3-tab shell with SmoothTab + design system. Deploy to Vercel. Give me exact steps to set up Supabase, Vercel and env vars on Windows, and to install on iPhone.
2. **Onboarding + targets** (§6) and Profile details/targets editing.
3. **Home without AI:** header rings, water (+/−), creatine + warning, manual entry, meal list with swipe/undo, 3 AM day logic, offline queue.
4. **AI logging:** camera (multi-photo + note), voice, chat, confirmation card, rate limits, `ai_usage` logging.
5. **AI Meals tab:** suggestions, hunger request, pantry, caching.
6. **Profile extras:** history, insights charts, monthly summary, CSV export, usage & cost view.
7. **Search + notifications:** global search with Ask AI; Web Push and scheduled reminders.
8. **Polish:** performance pass (Lighthouse, bundle size), animation polish, empty/error states, accessibility.

For each phase: list what you'll build, build it, then tell me exactly how to test it on my iPhone. Keep explanations short.

## 16. Ground rules for the agent

- Ask before adding any dependency not listed here, or before deviating from this spec.
- Prefer simple, readable code over clever abstractions. No placeholder or mock data in finished features.
- Never commit secrets. Provide `.env.example`.
- Write a short `README.md`: setup, env vars, deploy, install on iPhone, how to add a new user.

---

## 17. Decisions made during the build (override earlier sections)

- **App name:** Tare.
- **Auth (§4):** Google sign-in first, email 6-digit code as a fallback. Invite-only: emails must be in `public.allowed_emails` (and added as test users on the Google OAuth app).
- **AI provider (§4, §12):** Claude. Photo estimates use Claude Sonnet 5.5; everything else uses Claude Haiku 4.5 (`AI_MODEL_PHOTO`, `AI_MODEL_TEXT`). Budget ~₹100–200/month.
- **Voice (§7.6):** live speech-to-text with ElevenLabs Scribe (realtime, punctuated), then the text is estimated like a typed entry. When the free ElevenLabs minutes run out, voice falls back to the typing sheet.
- **Extra tables:** `weight_logs` (weight trend in Insights) and `reminder_log` (each reminder at most once a day).
- **Scheduler (§11):** Supabase `pg_cron` calls `/api/cron/reminders` every 15 minutes (Vercel's free cron only runs daily).
- **Extra packages:** `@anthropic-ai/sdk`, `web-push`.
- **Day start (§5):** each user picks when their day resets (midnight–6 AM, default 3 AM) in onboarding and Profile (`profiles.day_start_hour`).
- **Cost control (§8, §12):** AI Meals suggestions are made only when the user taps a button (not on opening the tab); estimate prompts omit the pantry; suggestion answers are kept short.
- **Status bar:** `black`, not `black-translucent` (the translucent style makes iOS shorten home-screen apps at the bottom).
