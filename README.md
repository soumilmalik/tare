# Tare

A minimal, fast tracker for calories, protein and water. Installed on iPhone as a PWA. See `SPEC.md` for the full product spec.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui · motion · Serwist (PWA) · Supabase (Postgres + Auth + RLS) · Vercel.

## Local development (WSL)

```bash
cd ~/calorietracker
cp .env.example .env.local     # then fill in the Supabase values
npm install
npm run dev                    # http://localhost:3000
```

`npm run dev` runs without the service worker. To test the real PWA build: `npm run build && npm start`.

## Environment variables

| Name | Where to find it | Needed from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys → Project URL | Phase 1 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → Publishable key | Phase 1 |
| The rest of `.env.example` | Added as each phase needs them | Later |

Never commit `.env.local`. It is git-ignored.

## Supabase setup (one time)

1. Go to [supabase.com](https://supabase.com) and **Continue with GitHub**. Create a **New project**:
   - Region: **South Asia (Mumbai)**.
   - Save the database password somewhere safe.
2. **SQL Editor → New query**. Paste all of `supabase/migrations/0001_init.sql` and click **Run**. It should say "Success. No rows returned".
3. **Authentication → Sign In / Providers → Email**:
   - Keep **Email** enabled.
   - Set **Email OTP Length** to **6**.
   - Save.
4. **Send emails from your own Gmail.** Supabase only lets you edit email templates after you connect your own sender.
   - In your Google account, turn on **2-Step Verification**. Then open [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) and create an app password named `Tare`.
   - In Supabase, go to **Authentication → Emails → Set up SMTP** and turn on custom SMTP:
     - Sender email: your Gmail address. Sender name: `Tare`.
     - Host: `smtp.gmail.com`. Port: `465`.
     - Username: your Gmail address. Password: the app password.
   - Then open **Authentication → Emails → Magic link or OTP**. Set the subject to `Your Tare code` and the body to:
   ```html
   <h2>Your Tare code</h2>
   <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
   <p>It expires in 1 hour. If you didn't ask for it, ignore this email.</p>
   ```
   - If there is a separate **Confirm signup** template, give it the same subject and body.
5. **Invite-only access:** in the SQL Editor, run `supabase/migrations/0002_allowed_emails.sql`. Then open **Table Editor → allowed_emails** and **Insert row** for each person who may use the app. Use lowercase emails.
6. **Google sign-in:**
   - In [Google Cloud Console](https://console.cloud.google.com), create a project named `Tare`.
   - Open **Google Auth Platform → Get started**. Set the app name to `Tare`, audience to **External**, and add your email. Then click **Publish app** under **Audience**.
   - Go to **Clients → Create client → Web application**. Add this authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. Copy the **Client ID** and **Client secret**.
   - In Supabase, go to **Authentication → Sign In / Providers → Google**. Turn it on, paste the client ID and secret, and save.
7. **Authentication → URL Configuration:**
   - **Site URL:** your Vercel URL, e.g. `https://tare.vercel.app`.
   - **Redirect URLs:** add `http://localhost:3000/**` and `https://<your-vercel-url>/**`.
8. **Project Settings → API Keys**: copy the **Project URL** and the **Publishable key** into `.env.local` and into Vercel.

Gmail allows about 500 emails a day, which is plenty for a few users. To share the app widely, switch the SMTP settings to a dedicated sender such as Resend.

## Deploy to Vercel

1. Push this folder to a **private** GitHub repo.
2. Go to [vercel.com](https://vercel.com) and **Continue with GitHub**, then **Add New → Project** and import the repo.
3. Before deploying, open **Environment Variables** and add the two `NEXT_PUBLIC_SUPABASE_*` values. Then click **Deploy**.
4. Every `git push` to `main` redeploys automatically.

## Install on iPhone

1. Open the Vercel URL in **Safari**. It must be Safari, not Chrome.
2. Tap **Share → Add to Home Screen**. Make sure **Open as Web App** is on, then tap **Add**.
3. Open **Tare** from the home screen and sign in with your email code. You stay signed in inside the app.

## Adding a new user

1. Supabase → **Table Editor → allowed_emails → Insert row**. Add their email in lowercase.
2. Send them the URL. They install it as described above and tap **Continue with Google**, or use an email code. Their profile is created automatically, and Row Level Security means each person only ever sees their own data.

**Removing someone:** delete their row in `allowed_emails`, then delete their account under **Authentication → Users**.

## Project layout

```
app/                  routes (/, /login, /auth/callback, /~offline), manifest, service worker (sw.ts)
components/           app shell, tab bar (smooth-tab.tsx), tab screens
lib/supabase/         browser / server / proxy Supabase clients
lib/dates.ts          3 AM "logical day" helpers (IST default)
proxy.ts              refreshes the session, redirects signed-out users to /login
supabase/migrations/  database schema + RLS
assets/icon.svg       app icon source → `npm run icons` regenerates PNGs
reference/            original UI components from the spec (not built)
```
