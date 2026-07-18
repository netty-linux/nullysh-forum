-- =============================================================================
-- FIX #12 — Bucket 'posts' privado (conteúdo VIP)
-- OWASP A05 — Security Misconfiguration
-- Idempotente.
-- Nota: frontend deve usar URLs assinadas para bucket posts
--       (uploadUserMedia em src/lib/supabase/storage.ts).
-- =============================================================================

update storage.buckets
set public = false
where id = 'posts';

-- Leitura pública só avatars / banners / emojis
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read"
  on storage.objects for select
  using (bucket_id in ('avatars', 'banners', 'emojis'));

-- Posts: só authenticated
drop policy if exists "posts_media_read_authenticated" on storage.objects;
create policy "posts_media_read_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'posts');

-- Upload posts: dono da pasta (userId)
drop policy if exists "posts_media_auth_upload" on storage.objects;
create policy "posts_media_auth_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'posts'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update/delete próprio objeto no bucket posts
drop policy if exists "posts_media_auth_update" on storage.objects;
create policy "posts_media_auth_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "posts_media_auth_delete" on storage.objects;
create policy "posts_media_auth_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
