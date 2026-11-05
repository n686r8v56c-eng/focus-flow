-- Run once in the Focus Flow Supabase project's SQL editor.
-- Images live in a PRIVATE storage bucket; users can only access their own folder.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('focus-inbox-images','focus-inbox-images',false,5242880,array['image/jpeg'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg'];
drop policy if exists "Focus inbox images read own" on storage.objects;
drop policy if exists "Focus inbox images upload own" on storage.objects;
drop policy if exists "Focus inbox images delete own" on storage.objects;
create policy "Focus inbox images read own" on storage.objects for select to authenticated
using (bucket_id='focus-inbox-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Focus inbox images upload own" on storage.objects for insert to authenticated
with check (bucket_id='focus-inbox-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Focus inbox images delete own" on storage.objects for delete to authenticated
using (bucket_id='focus-inbox-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
