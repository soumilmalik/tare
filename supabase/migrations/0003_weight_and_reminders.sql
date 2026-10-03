-- Tare — weight history (for the Insights weight trend) and a reminder log
-- (so each push reminder is sent at most once per day).

create table public.weight_logs (
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on date not null,
  weight_kg numeric(5, 1) not null check (weight_kg between 25 and 300),
  primary key (user_id, logged_on)
);
alter table public.weight_logs enable row level security;
create policy "own rows" on public.weight_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.weight_logs to authenticated;

-- Written only by the server's reminder job (secret key), never by the app.
create table public.reminder_log (
  user_id      uuid not null references auth.users (id) on delete cascade,
  logical_date date not null,
  kind         text not null check (kind in ('water', 'creatine', 'meal')),
  sent_at      timestamptz not null default now(),
  primary key (user_id, logical_date, kind)
);
alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;
