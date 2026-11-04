-- Apply this in the Focus Flow Supabase SQL Editor (NOT the Beauty Care project).
-- Additive, user-isolated diet records, no existing tables altered.

-- Focus Flow / independent diet tab (Focus Flow-style UI)
-- ADDITIVE: no changes to Focus Flow or existing Focus tables.
create table if not exists public.focus_diet_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  water_cups integer not null default 0 check (water_cups >= 0 and water_cups <= 100),
  vegetables boolean not null default false,
  supplements boolean not null default false,
  step_count integer check (step_count >= 0 and step_count <= 200000),
  sleep_start timestamptz,
  sleep_end timestamptz,
  calories numeric(9,2),
  protein_g numeric(9,2),
  carbs_g numeric(9,2),
  fat_g numeric(9,2),
  nutrition_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_date)
);
create table if not exists public.focus_diet_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists focus_diet_logs_user_date_idx on public.focus_diet_logs(user_id,record_date);
create table if not exists public.focus_diet_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  water_cups integer not null default 20,
  cup_ml integer not null default 250,
  calories numeric(9,2) not null default 1400,
  protein_g numeric(9,2) not null default 100,
  carbs_g numeric(9,2) not null default 150,
  fat_g numeric(9,2) not null default 50
);
alter table public.focus_diet_days enable row level security;
alter table public.focus_diet_logs enable row level security;
alter table public.focus_diet_goals enable row level security;
drop policy if exists focus_diet_days_owner on public.focus_diet_days;
create policy focus_diet_days_owner on public.focus_diet_days for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists focus_diet_logs_owner on public.focus_diet_logs;
create policy focus_diet_logs_owner on public.focus_diet_logs for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists focus_diet_goals_owner on public.focus_diet_goals;
create policy focus_diet_goals_owner on public.focus_diet_goals for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- Focus Flow: injection and menstrual milestone date records.
-- Additive migration. Does not modify existing diet records or Focus Flow data.
create table if not exists public.focus_health_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  event_type text not null check (event_type in ('mounjaro','period_start','period_end')),
  created_at timestamptz not null default now(),
  unique (user_id,record_date,event_type)
);
create index if not exists focus_health_events_user_date_idx
  on public.focus_health_events (user_id,record_date);
alter table public.focus_health_events enable row level security;
drop policy if exists focus_health_events_owner on public.focus_health_events;
create policy focus_health_events_owner
  on public.focus_health_events for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
