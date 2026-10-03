-- Tare — invite-only access.
-- Only emails listed in public.allowed_emails can create an account (Google or
-- email code). Manage the list in Supabase → Table Editor → allowed_emails.

create table public.allowed_emails (
  email      text primary key check (email = lower(email) and email like '%@%'),
  note       text,
  created_at timestamptz not null default now()
);

-- Nobody can read or change the list through the app's API; only the
-- dashboard (and the signup check below) can see it.
alter table public.allowed_emails enable row level security;
revoke all on public.allowed_emails from anon, authenticated;

-- Runs when a new account is created: reject emails not on the list,
-- otherwise create the empty profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.allowed_emails a where a.email = lower(new.email)
  ) then
    raise exception 'TARE_NOT_ALLOWED: % is not on the access list', new.email;
  end if;

  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

-- The existing on_auth_user_created trigger now runs this version. Raising an
-- exception rolls back the whole signup, so no account is created.
