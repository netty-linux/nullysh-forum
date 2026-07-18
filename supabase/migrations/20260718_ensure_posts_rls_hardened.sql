-- =============================================================================
-- FIX #3 — Garante RLS posts/comments: update só dono ou admin
-- OWASP A01 — Broken Access Control
-- Idempotente independentemente da ordem das migrations anteriores.
-- =============================================================================

-- posts: remove policy vulnerável (qualquer authenticated edita qualquer post)
drop policy if exists "posts_update_auth" on public.posts;
drop policy if exists "posts_update_own_or_admin" on public.posts;

create policy "posts_update_own_or_admin"
  on public.posts for update
  using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

-- comments: update restrito a dono ou admin
drop policy if exists "comments_update_auth" on public.comments;
drop policy if exists "comments_update_own" on public.comments;
drop policy if exists "comments_update_own_or_admin" on public.comments;

create policy "comments_update_own_or_admin"
  on public.comments for update
  using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());
