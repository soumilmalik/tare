-- Tare — let each user choose when their day resets (default 3:00 AM).
alter table public.profiles
  add column day_start_hour smallint not null default 3 check (day_start_hour between 0 and 6);
