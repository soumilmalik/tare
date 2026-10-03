-- Tare — initial schema (SPEC §5).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Every table has Row Level Security: users only ever see their own rows.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The day resets at 3:00 AM in the user's timezone.
create or replace function public.logical_date(ts timestamptz, tz text default 'Asia/Kolkata')
returns date
language sql
stable
set search_path = ''
as $$
  select ((ts at time zone tz) - interval '3 hours')::date;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  name                  text,
  sex                   text check (sex in ('male', 'female')),
  age                   int check (age between 10 and 100),
  height_cm             numeric(5, 1) check (height_cm between 100 and 250),
  weight_kg             numeric(5, 1) check (weight_kg between 25 and 300),
  goal_weight_kg        numeric(5, 1) check (goal_weight_kg between 25 and 300),
  timeline_weeks        int check (timeline_weeks between 1 and 260),
  workout_days_per_week int check (workout_days_per_week between 0 and 7),
  workout_type          text check (workout_type in ('strength', 'cardio', 'sports', 'yoga', 'mixed')),
  workout_minutes       int check (workout_minutes between 0 and 600),
  diet_type             text check (diet_type in ('veg', 'egg', 'non-veg')),
  allergies_or_avoid    text,
  takes_creatine        boolean not null default false,
  target_kcal           int check (target_kcal between 800 and 6000),
  target_protein_g      int check (target_protein_g between 20 and 400),
  target_water_ml       int check (target_water_ml between 500 and 8000),
  timezone              text not null default 'Asia/Kolkata',
  notify_water          boolean not null default true,
  water_reminder_time   time not null default '20:00',
  notify_creatine       boolean not null default true,
  creatine_reminder_time time not null default '10:00',
  notify_meal_nudge     boolean not null default false,
  onboarded_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create an empty profile row for every new sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- regular_foods, pantry
-- ---------------------------------------------------------------------------
create table public.regular_foods (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_slot       text not null check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack', 'regular')),
  description     text not null check (length(description) between 1 and 500),
  typical_kcal    int check (typical_kcal >= 0),
  typical_protein numeric(6, 1) check (typical_protein >= 0),
  created_at      timestamptz not null default now()
);
create index regular_foods_user_idx on public.regular_foods (user_id);

create table public.pantry (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ingredient text not null check (length(ingredient) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index pantry_user_ingredient_idx on public.pantry (user_id, lower(ingredient));

-- ---------------------------------------------------------------------------
-- daily_summary — one tiny row per user per day, kept in sync by triggers
-- ---------------------------------------------------------------------------
create table public.daily_summary (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logical_date   date not null,
  kcal           int not null default 0,
  protein_g      numeric(6, 1) not null default 0,
  water_ml       int not null default 0,
  creatine_taken boolean not null default false,
  primary key (user_id, logical_date)
);

-- ---------------------------------------------------------------------------
-- meal_logs
-- ---------------------------------------------------------------------------
-- `id` may be generated on the device so offline entries can be queued safely.
create table public.meal_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logical_date  date not null,
  logged_at     timestamptz not null default now(),
  title         text not null check (length(title) between 1 and 200),
  items         jsonb not null default '[]'::jsonb,
  total_kcal    int not null default 0 check (total_kcal between 0 and 20000),
  total_protein numeric(6, 1) not null default 0 check (total_protein between 0 and 1000),
  source        text not null check (source in ('photo', 'voice', 'text', 'manual')),
  user_edited   boolean not null default false,
  deleted_at    timestamptz
);
create index meal_logs_user_date_idx on public.meal_logs (user_id, logical_date);

-- ---------------------------------------------------------------------------
-- water_logs (never shown in the meal list)
-- ---------------------------------------------------------------------------
create table public.water_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logical_date date not null,
  ml           int not null check (ml in (250, -250)),
  logged_at    timestamptz not null default now()
);
create index water_logs_user_date_idx on public.water_logs (user_id, logical_date);

-- ---------------------------------------------------------------------------
-- Keep daily_summary in sync with meal_logs and water_logs
-- ---------------------------------------------------------------------------
create or replace function public.refresh_daily_summary(p_user uuid, p_date date)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.daily_summary as d (user_id, logical_date, kcal, protein_g, water_ml)
  select
    p_user,
    p_date,
    coalesce((select sum(m.total_kcal) from public.meal_logs m
              where m.user_id = p_user and m.logical_date = p_date and m.deleted_at is null), 0),
    coalesce((select sum(m.total_protein) from public.meal_logs m
              where m.user_id = p_user and m.logical_date = p_date and m.deleted_at is null), 0),
    greatest(coalesce((select sum(w.ml) from public.water_logs w
              where w.user_id = p_user and w.logical_date = p_date), 0), 0)
  on conflict (user_id, logical_date) do update
    set kcal = excluded.kcal,
        protein_g = excluded.protein_g,
        water_ml = excluded.water_ml;
end;
$$;

create or replace function public.on_log_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_daily_summary(new.user_id, new.logical_date);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.logical_date <> new.logical_date) then
    perform public.refresh_daily_summary(old.user_id, old.logical_date);
  end if;
  return null;
end;
$$;

create trigger meal_logs_summary
  after insert or update or delete on public.meal_logs
  for each row execute function public.on_log_change();

create trigger water_logs_summary
  after insert or delete on public.water_logs
  for each row execute function public.on_log_change();

-- ---------------------------------------------------------------------------
-- monthly_summaries, ai_usage, push_subscriptions
-- ---------------------------------------------------------------------------
create table public.monthly_summaries (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month      date not null check (extract(day from month) = 1),
  text       text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, month)
);

create table public.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feature       text not null,
  model         text,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  est_cost_inr  numeric(10, 4) not null default 0,
  created_at    timestamptz not null default now()
);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at);

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint     text not null unique,
  subscription jsonb not null,
  created_at   timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: own rows only
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'regular_foods', 'pantry', 'daily_summary', 'meal_logs',
    'water_logs', 'monthly_summaries', 'push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- ai_usage is append-only for users (cost records can't be edited or deleted).
alter table public.ai_usage enable row level security;
create policy "read own usage" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));
create policy "insert own usage" on public.ai_usage for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Signed-out visitors get nothing; signed-in users get the RLS-filtered tables.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke update, delete on public.ai_usage from authenticated;

-- Internal functions aren't part of the public API.
-- (refresh_daily_summary stays callable by signed-in users: the log triggers run as them,
-- and RLS limits it to their own rows.)
revoke execute on function public.refresh_daily_summary(uuid, date) from public, anon;
grant execute on function public.refresh_daily_summary(uuid, date) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
