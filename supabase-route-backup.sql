-- One SQL run; reuses the user's existing route_backups and Route_photos.
-- No existing rows, files or other policies are deleted.
begin;
create table if not exists public.route_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  snapshot_version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.route_backups enable row level security;
grant select,insert,update on public.route_backups to authenticated;
insert into storage.buckets(id,name,public)
values ('Route_photos','Route_photos',false) on conflict (id) do update set public=false;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='route_backups' and policyname='route_backups_select_own') then
    create policy route_backups_select_own on public.route_backups for select to authenticated using ((select auth.uid())=user_id);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='route_backups' and policyname='route_backups_insert_own') then
    create policy route_backups_insert_own on public.route_backups for insert to authenticated with check ((select auth.uid())=user_id);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='route_backups' and policyname='route_backups_update_own') then
    create policy route_backups_update_own on public.route_backups for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
  end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='route_photos_select_own') then
    create policy route_photos_select_own on storage.objects for select to authenticated using (bucket_id='Route_photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
  end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='route_photos_insert_own') then
    create policy route_photos_insert_own on storage.objects for insert to authenticated with check (bucket_id='Route_photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
  end if;
end $$;
commit;
