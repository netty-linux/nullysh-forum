-- =============================================================================
-- P1 · Domínio real multi-user — hardening (profiles / posts / RLS / trigger)
-- =============================================================================
-- Contexto:
--   O schema inicial (20260710_nullysh_init.sql) JÁ cria `profiles` e `posts`
--   com colunas mais ricas do que o mini-spec do Architect (name vs full_name,
--   author_id vs user_id, image_url vs media_url, etc.).
--
-- Esta migration é INCREMENTAL:
--   1) Não recria tabelas do zero (evita quebrar auth-service / mappers).
--   2) Garante colunas úteis ao feed multi-user (hashtag, username NOT NULL).
--   3) Endurece RLS: admin pode update/delete; dono só no próprio recurso.
--   4) Melhora o trigger handle_new_user (username + metadata).
--
-- Como aplicar:
--   Supabase Dashboard → SQL → New query → colar este arquivo → Run
--   (ou `supabase db push` se CLI estiver linkada ao projeto)
-- =============================================================================

create extension if not exists "pgcrypto";

-- ─── 1) Colunas / índices de domínio ───────────────────────────────────────

-- Username (migration 20260710_profile_username pode já ter aplicado)
alter table public.profiles
  add column if not exists username text;

-- Preenche username vazio a partir do e-mail (idempotente)
update public.profiles
set username = lower(
  left(
    regexp_replace(split_part(coalesce(email, id::text), '@', 1), '[^a-z0-9_]', '', 'g'),
    24
  )
)
where username is null or btrim(username) = '';

update public.profiles
set username = left(coalesce(nullif(username, ''), 'user') || 'user', 24)
where length(coalesce(username, '')) < 3;

-- Resolve colisões de username
with dups as (
  select id, username,
    row_number() over (partition by lower(username) order by created_at) as rn
  from public.profiles
  where username is not null
)
update public.profiles p
set username = left(p.username, 16) || '_' || substr(replace(p.id::text, '-', ''), 1, 6)
from dups d
where p.id = d.id and d.rn > 1;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username));

-- Hashtag do post (assuntos: #geral, #vips, #staff…)
alter table public.posts
  add column if not exists hashtag text;

comment on column public.posts.hashtag is
  'Assunto/hashtag normalizado (ex.: geral, vips, staff) — sync com comunidades';

create index if not exists posts_hashtag_idx
  on public.posts (hashtag)
  where hashtag is not null;

create index if not exists posts_author_created_idx
  on public.posts (author_id, created_at desc);

-- Alias lógico documentado (não duplicamos colunas):
--   profiles.full_name  ≈ profiles.name
--   posts.user_id       ≈ posts.author_id
--   posts.media_url     ≈ posts.image_url

-- ─── 2) Helper: is_admin() ─────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True se o usuário autenticado tem role admin em public.profiles';

grant execute on function public.is_admin() to authenticated, anon;

-- ─── 3) Trigger: auto-profile no signup (com username) ─────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  initial text;
  uname text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(coalesce(new.email, 'membro'), '@', 1),
    'Membro'
  );
  initial := upper(left(display_name, 1));

  uname := lower(
    regexp_replace(
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'username'), ''),
        split_part(coalesce(new.email, new.id::text), '@', 1)
      ),
      '[^a-z0-9_]',
      '',
      'g'
    )
  );
  if length(uname) < 3 then
    uname := left(uname || 'user', 24);
  end if;
  uname := left(uname, 24);

  -- Se username já existir, sufixa com pedaço do uuid
  if exists (
    select 1 from public.profiles where lower(username) = uname
  ) then
    uname := left(uname, 16) || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  insert into public.profiles (id, email, name, avatar, username, role, is_vip)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@users.local'),
    display_name,
    initial,
    uname,
    'member',
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    -- só preenche username se ainda nulo
    username = coalesce(public.profiles.username, excluded.username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── 4) RLS profiles ───────────────────────────────────────────────────────

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Dono OU admin
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ─── 5) RLS posts ──────────────────────────────────────────────────────────

alter table public.posts enable row level security;

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all"
  on public.posts for select
  using (true);

drop policy if exists "posts_insert_auth" on public.posts;
create policy "posts_insert_auth"
  on public.posts for insert
  with check (
    auth.uid() is not null
    and auth.uid() = author_id
  );

-- Antes: qualquer authenticated podia update — risco. Agora: dono ou admin.
drop policy if exists "posts_update_auth" on public.posts;
drop policy if exists "posts_update_own_or_admin" on public.posts;
create policy "posts_update_own_or_admin"
  on public.posts for update
  using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

drop policy if exists "posts_delete_own" on public.posts;
drop policy if exists "posts_delete_own_or_admin" on public.posts;
create policy "posts_delete_own_or_admin"
  on public.posts for delete
  using (auth.uid() = author_id or public.is_admin());

-- ─── 6) Comentários: admin também pode apagar ──────────────────────────────

alter table public.comments enable row level security;

drop policy if exists "comments_delete_own" on public.comments;
drop policy if exists "comments_delete_own_or_admin" on public.comments;
create policy "comments_delete_own_or_admin"
  on public.comments for delete
  using (auth.uid() = author_id or public.is_admin());

-- ─── 7) Grants básicos ─────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.posts to anon, authenticated;
grant select, insert, update, delete on public.posts to authenticated;

-- ─── 8) Smoke checks (opcional no SQL Editor) ──────────────────────────────
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('profiles','posts');
-- select policyname, cmd from pg_policies where tablename in ('profiles','posts');
-- select column_name from information_schema.columns where table_name = 'posts' and column_name = 'hashtag';
