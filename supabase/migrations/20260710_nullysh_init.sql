-- Nullysh Forum · schema inicial (Supabase)
-- Project: rijnjymmivsftkjnhnup
-- Rode no SQL Editor do Supabase (Dashboard → SQL → New query)

-- ─── Extensões ─────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Enums ─────────────────────────────────────────────────
do $$ begin
  create type public.user_role as enum ('member', 'vip', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.verification_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.post_type as enum ('discussion', 'news', 'tutorial', 'announcement');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.music_platform as enum ('spotify', 'youtube', 'soundcloud');
exception when duplicate_object then null;
end $$;

-- ─── Profiles (1:1 com auth.users) ─────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  bio text not null default '',
  avatar text not null default 'U',
  avatar_url text,
  banner_url text,
  banner_fit jsonb,
  avatar_frame text,
  role public.user_role not null default 'member',
  is_vip boolean not null default false,
  is_verified boolean not null default false,
  interests jsonb not null default '[]'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  seeking_mentorship boolean not null default false,
  offering_mentorship boolean not null default false,
  mentor_topics jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  favorite_tracks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_role_idx on public.profiles (role);

-- ─── Posts ─────────────────────────────────────────────────
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  author_avatar text not null default 'U',
  author_avatar_url text,
  community_id text,
  community_name text,
  title text,
  content text not null default '',
  image_url text,
  location text,
  type public.post_type not null default 'discussion',
  likes int not null default 0,
  comments_count int not null default 0,
  liked_by uuid[] not null default '{}',
  vip_only boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_author_id_idx on public.posts (author_id);

-- ─── Comments ──────────────────────────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  author_avatar text not null default 'U',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_post_id_idx on public.comments (post_id);

-- ─── Chat messages (canais + DMs) ──────────────────────────
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  author_avatar text not null default 'U',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_channel_idx
  on public.chat_messages (channel_id, created_at);

-- ─── Custom emojis (VIP) ───────────────────────────────────
create table if not exists public.custom_emojis (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  image_url text not null,
  created_by_id uuid not null references public.profiles (id) on delete cascade,
  created_by_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists custom_emojis_name_idx on public.custom_emojis (lower(name));

-- ─── Verification requests ─────────────────────────────────
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null,
  user_email text not null,
  reason text not null,
  identity text not null,
  links text not null default '',
  community_use text not null,
  is_real_person boolean not null default true,
  status public.verification_status not null default 'pending',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id)
);

create index if not exists verification_status_idx
  on public.verification_requests (status, created_at desc);

-- ─── Trail progress / RSVPs ────────────────────────────────
create table if not exists public.trail_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  trail_id text not null,
  completed_step_ids text[] not null default '{}',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trail_id)
);

create table if not exists public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ─── updated_at trigger ────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─── Auto-create profile on signup ─────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  initial text;
begin
  display_name := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'Membro'
  );
  initial := upper(left(display_name, 1));

  insert into public.profiles (id, email, name, avatar)
  values (new.id, new.email, display_name, initial)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── RLS ───────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.chat_messages enable row level security;
alter table public.custom_emojis enable row level security;
alter table public.verification_requests enable row level security;
alter table public.trail_progress enable row level security;
alter table public.event_rsvps enable row level security;

-- Profiles
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Posts
drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all"
  on public.posts for select using (true);

drop policy if exists "posts_insert_auth" on public.posts;
create policy "posts_insert_auth"
  on public.posts for insert
  with check (auth.uid() = author_id);

drop policy if exists "posts_update_auth" on public.posts;
create policy "posts_update_auth"
  on public.posts for update
  using (auth.role() = 'authenticated');

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
  on public.posts for delete
  using (auth.uid() = author_id);

-- Comments
drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all"
  on public.comments for select using (true);

drop policy if exists "comments_insert_auth" on public.comments;
create policy "comments_insert_auth"
  on public.comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own"
  on public.comments for delete
  using (auth.uid() = author_id);

-- Chat
drop policy if exists "chat_select_auth" on public.chat_messages;
create policy "chat_select_auth"
  on public.chat_messages for select
  using (auth.role() = 'authenticated');

drop policy if exists "chat_insert_auth" on public.chat_messages;
create policy "chat_insert_auth"
  on public.chat_messages for insert
  with check (auth.uid() = author_id);

-- Emojis
drop policy if exists "emojis_select_all" on public.custom_emojis;
create policy "emojis_select_all"
  on public.custom_emojis for select using (true);

drop policy if exists "emojis_insert_vip" on public.custom_emojis;
create policy "emojis_insert_vip"
  on public.custom_emojis for insert
  with check (
    auth.uid() = created_by_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.is_vip or p.role = 'admin')
    )
  );

drop policy if exists "emojis_delete_own_or_admin" on public.custom_emojis;
create policy "emojis_delete_own_or_admin"
  on public.custom_emojis for delete
  using (
    auth.uid() = created_by_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Verification
drop policy if exists "verification_select_own_or_admin" on public.verification_requests;
create policy "verification_select_own_or_admin"
  on public.verification_requests for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "verification_insert_own" on public.verification_requests;
create policy "verification_insert_own"
  on public.verification_requests for insert
  with check (auth.uid() = user_id);

drop policy if exists "verification_update_admin" on public.verification_requests;
create policy "verification_update_admin"
  on public.verification_requests for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Progress / RSVP
drop policy if exists "trail_select_own" on public.trail_progress;
create policy "trail_select_own"
  on public.trail_progress for select using (auth.uid() = user_id);

drop policy if exists "trail_upsert_own" on public.trail_progress;
create policy "trail_upsert_own"
  on public.trail_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "rsvp_select_auth" on public.event_rsvps;
create policy "rsvp_select_auth"
  on public.event_rsvps for select
  using (auth.role() = 'authenticated');

drop policy if exists "rsvp_all_own" on public.event_rsvps;
create policy "rsvp_all_own"
  on public.event_rsvps for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Storage buckets ───────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    6291456,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'banners',
    'banners',
    true,
    12582912,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'emojis',
    'emojis',
    true,
    3145728,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'posts',
    'posts',
    true,
    6291456,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies (public read, auth write own folder)
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

-- ─── Helper: promote admin by email (rode manualmente se quiser) ─
-- update public.profiles
-- set role = 'admin', is_vip = true, is_verified = true
-- where email = 'admin@nullysh.com';
