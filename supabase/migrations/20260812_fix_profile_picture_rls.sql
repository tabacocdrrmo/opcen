-- Fix: allow uploads to the profile-pictures storage bucket.
-- Run in the Supabase SQL editor (or via supabase db push).

drop policy if exists "profile-pictures insert" on storage.objects;
create policy "profile-pictures insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-pictures');

drop policy if exists "profile-pictures update" on storage.objects;
create policy "profile-pictures update" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-pictures');

drop policy if exists "profile-pictures select" on storage.objects;
create policy "profile-pictures select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'profile-pictures');
