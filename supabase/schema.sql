-- Donation app: run this once in Supabase SQL Editor (new project).
-- Then create Storage bucket "receipts" (public) and add policy for anon INSERT.

-- 1) Tables
create table public.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz default now()
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_name text not null,
  amount numeric not null,
  currency text not null default 'usd',
  receipt_url text,
  admin_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- 2) RLS: admins (read for dropdown, insert for trigger)
alter table public.admins enable row level security;

create policy "admins_select" on public.admins
  for select using (true);

create policy "admins_insert_allow" on public.admins
  for insert with check (true);

-- 3) RLS: donations (admin sees own; anyone can insert for donation form)
alter table public.donations enable row level security;

create policy "donations_select_own" on public.donations
  for select using (admin_id = auth.uid());

-- Explicit roles so anonymous visitors can submit the public donation form
create policy "donations_insert_anon" on public.donations
  for insert to anon with check (true);

create policy "donations_insert_authenticated" on public.donations
  for insert to authenticated with check (true);

grant insert on public.donations to anon;
grant insert on public.donations to authenticated;

-- Public donation form: insert via RPC (bypasses RLS issues for anon clients)
create or replace function public.submit_donation(
  p_donor_name text,
  p_amount numeric,
  p_currency text,
  p_receipt_url text,
  p_admin_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  cur text;
begin
  if p_donor_name is null or length(trim(p_donor_name)) = 0 then
    raise exception 'donor_name required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;
  if not exists (select 1 from public.admins where user_id = p_admin_id) then
    raise exception 'invalid admin';
  end if;
  cur := lower(trim(coalesce(p_currency, 'usd')));
  if cur not in ('usd', 'try', 'syp') then
    cur := 'usd';
  end if;
  insert into public.donations (donor_name, amount, currency, receipt_url, admin_id)
  values (trim(p_donor_name), p_amount, cur, nullif(trim(p_receipt_url), ''), p_admin_id)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.submit_donation(text, numeric, text, text, uuid) from public;
grant execute on function public.submit_donation(text, numeric, text, text, uuid) to anon;
grant execute on function public.submit_donation(text, numeric, text, text, uuid) to authenticated;

-- 4) Trigger: when a user is created in Auth, add row to admins
create or replace function public.handle_new_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admins (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', 'مسؤول')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_admin();

-- 5) First admin: create user in Authentication → Users, then run:
-- insert into public.admins (user_id, display_name) values ('USER_UUID', 'اسم المسؤول');

-- 6) If donations table already exists without currency, run:
-- alter table public.donations add column if not exists currency text not null default 'usd';
