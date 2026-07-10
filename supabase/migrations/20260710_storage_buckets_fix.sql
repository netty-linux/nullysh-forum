-- Se os buckets não apareceram, rode este script no SQL Editor.
-- (Dashboard → SQL → New query → Run)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 8388608,
    array['image/jpeg','image/png','image/webp','image/gif']),
  ('banners', 'banners', true, 15728640,
    array['image/jpeg','image/png','image/webp','image/gif']),
  ('emojis', 'emojis', true, 3145728,
    array['image/jpeg','image/png','image/webp','image/gif']),
  ('posts', 'posts', true, 6291456,
    array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies de storage (idempotente)
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read"
  on storage.objects for select
  using (bucket_id in ('avatars', 'banners', 'emojis', 'posts'));

drop policy if exists "media_auth_upload" on storage.objects;
create policy "media_auth_upload"
  on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'banners', 'emojis', 'posts')
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media_auth_update" on storage.objects;
create policy "media_auth_update"
  on storage.objects for update
  using (
    bucket_id in ('avatars', 'banners', 'emojis', 'posts')
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media_auth_delete" on storage.objects;
create policy "media_auth_delete"
  on storage.objects for delete
  using (
    bucket_id in ('avatars', 'banners', 'emojis', 'posts')
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Conferência
select id, public, file_size_limit from storage.buckets
where id in ('avatars','banners','emojis','posts');
