-- Focus Flow: user-owned app state
create table if not exists public.focus_flow_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"projects":[],"tasks":[],"sessions":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.focus_flow_states enable row level security;
drop policy if exists "Read own Focus Flow state" on public.focus_flow_states;
drop policy if exists "Insert own Focus Flow state" on public.focus_flow_states;
drop policy if exists "Update own Focus Flow state" on public.focus_flow_states;
create policy "Read own Focus Flow state" on public.focus_flow_states for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own Focus Flow state" on public.focus_flow_states for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own Focus Flow state" on public.focus_flow_states for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.focus_flow_states from anon;
grant select,insert,update on public.focus_flow_states to authenticated;
