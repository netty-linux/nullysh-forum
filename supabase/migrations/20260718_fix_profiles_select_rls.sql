-- =============================================================================
-- FIX #1 — RLS: profiles não expõe e-mails a anon
-- OWASP A01 — Broken Access Control
-- Idempotente: pode rodar múltiplas vezes.
-- =============================================================================

-- 1) Remove policy permissiva (anon + authenticated, using true)
drop policy if exists "profiles_select_all" on public.profiles;

-- 2) Authenticated: SELECT em todos os perfis (feed/social)
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- 3) Anon: sem SELECT direto na tabela (e-mails protegidos)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to anon
  using (false);

-- 4) View pública sem email (e sem account_status / status_reason)
create or replace view public.profiles_public as
  select
    id,
    name,
    username,
    bio,
    avatar,
    avatar_url,
    banner_url,
    banner_fit,
    avatar_frame,
    role,
    is_vip,
    is_verified,
    interests,
    goals,
    seeking_mentorship,
    offering_mentorship,
    mentor_topics,
    links,
    favorite_tracks,
    badges_unlocked,
    badge_equipped,
    created_at,
    updated_at
  from public.profiles;

comment on view public.profiles_public is
  'Perfil público sem email — uso por anon e listagens não-sensíveis';

grant select on public.profiles_public to anon, authenticated;

-- 5) Anon não lê profiles direto; authenticated mantém SELECT
revoke select on public.profiles from anon;
grant select on public.profiles to authenticated;
