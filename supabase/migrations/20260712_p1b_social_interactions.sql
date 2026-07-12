-- =============================================================================
-- P1.b · Interações sociais multi-user (likes, comments, GIF, notifications)
-- =============================================================================
-- Aplicar no SQL Editor do Supabase após 20260712_p1_domain_rls_hardening.sql
-- =============================================================================

-- ─── Posts: GIF + disliked_by (opcional) ───────────────────────────────────
alter table public.posts
  add column if not exists gif_url text;

comment on column public.posts.gif_url is 'URL HTTPS do GIF (Giphy)';

-- ─── Comments: campos de thread / GIF / likes ──────────────────────────────
alter table public.comments
  add column if not exists author_avatar_url text;

alter table public.comments
  add column if not exists gif_url text;

alter table public.comments
  add column if not exists parent_id uuid references public.comments (id) on delete cascade;

alter table public.comments
  add column if not exists reply_to_name text;

alter table public.comments
  add column if not exists reply_to_author_id uuid references public.profiles (id) on delete set null;

alter table public.comments
  add column if not exists liked_by uuid[] not null default '{}';

-- content pode ser vazio se só houver GIF
alter table public.comments
  alter column content set default '';

-- ─── Notifications (multi-user) ────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  href text not null default '/app',
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  dedupe_key text
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read = false;

-- ─── RPC: toggle like no post (security definer — contorna RLS de update) ─
create or replace function public.toggle_post_like(p_post_id uuid)
returns public.posts
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.posts;
  already boolean;
  actor text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into row from public.posts where id = p_post_id for update;
  if not found then
    raise exception 'post not found';
  end if;

  already := uid = any (coalesce(row.liked_by, '{}'));

  if already then
    update public.posts
    set
      liked_by = array_remove(coalesce(liked_by, '{}'), uid),
      likes = greatest(0, likes - 1)
    where id = p_post_id
    returning * into row;
  else
    update public.posts
    set
      liked_by = array_append(array_remove(coalesce(liked_by, '{}'), uid), uid),
      likes = likes + 1
    where id = p_post_id
    returning * into row;

    -- Notifica o dono do post (se não for self-like)
    if row.author_id is distinct from uid then
      select coalesce(p.name, 'Alguém') into actor
      from public.profiles p where p.id = uid;

      insert into public.notifications (
        user_id, type, title, body, href, actor_id, actor_name, dedupe_key
      )
      values (
        row.author_id,
        'like',
        'Nova curtida',
        actor || ' curtiu seu post' ||
          case
            when length(row.content) > 0 then ': “' || left(row.content, 48) || '”'
            else ''
          end,
        '/app?post=' || row.id::text,
        uid,
        actor,
        'like:' || row.id::text || ':' || uid::text
      )
      on conflict do nothing;
    end if;
  end if;

  return row;
end;
$$;

grant execute on function public.toggle_post_like(uuid) to authenticated;

-- Unique partial: evita spam de notif no mesmo dedupe (opcional via index)
create unique index if not exists notifications_dedupe_unique_idx
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

-- Re-cria a função com tratamento de unique violation no insert
create or replace function public.toggle_post_like(p_post_id uuid)
returns public.posts
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.posts;
  already boolean;
  actor text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into row from public.posts where id = p_post_id for update;
  if not found then
    raise exception 'post not found';
  end if;

  already := uid = any (coalesce(row.liked_by, '{}'));

  if already then
    update public.posts
    set
      liked_by = array_remove(coalesce(liked_by, '{}'), uid),
      likes = greatest(0, likes - 1)
    where id = p_post_id
    returning * into row;
  else
    update public.posts
    set
      liked_by = array_append(array_remove(coalesce(liked_by, '{}'), uid), uid),
      likes = likes + 1
    where id = p_post_id
    returning * into row;

    if row.author_id is distinct from uid then
      select coalesce(p.name, 'Alguém') into actor
      from public.profiles p where p.id = uid;

      begin
        insert into public.notifications (
          user_id, type, title, body, href, actor_id, actor_name, dedupe_key
        )
        values (
          row.author_id,
          'like',
          'Nova curtida',
          actor || ' curtiu seu post' ||
            case
              when length(trim(coalesce(row.content, ''))) > 0
                then ': “' || left(trim(row.content), 48) || '”'
              else ''
            end,
          '/app?post=' || row.id::text,
          uid,
          actor,
          'like:' || row.id::text || ':' || uid::text
        );
      exception when unique_violation then
        null; -- já notificou
      end;
    end if;
  end if;

  return row;
end;
$$;

-- ─── RLS comments (insert próprio; select público) ─────────────────────────
alter table public.comments enable row level security;

drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all"
  on public.comments for select using (true);

drop policy if exists "comments_insert_auth" on public.comments;
create policy "comments_insert_auth"
  on public.comments for insert
  with check (auth.uid() is not null and auth.uid() = author_id);

drop policy if exists "comments_delete_own" on public.comments;
drop policy if exists "comments_delete_own_or_admin" on public.comments;
drop policy if exists "comments_delete_own_owner_or_admin" on public.comments;
-- Autor do comentário, dono do post, ou admin
create policy "comments_delete_own_owner_or_admin"
  on public.comments for delete
  using (
    auth.uid() = author_id
    or public.is_admin()
    or exists (
      select 1 from public.posts p
      where p.id = comments.post_id and p.author_id = auth.uid()
    )
  );

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own"
  on public.comments for update
  using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

-- ─── RLS notifications ─────────────────────────────────────────────────────
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- Insert só via security definer (toggle_post_like / triggers). Bloqueia client direto.
drop policy if exists "notifications_insert_none" on public.notifications;
-- sem policy de insert para authenticated → só service/security definer

grant select, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.comments to authenticated;

-- Trigger: notificar dono do post em novo comentário
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  post_content text;
  recipient uuid;
  notif_title text;
  is_reply boolean;
begin
  select author_id, content into post_author, post_content
  from public.posts where id = new.post_id;

  is_reply := new.parent_id is not null and new.reply_to_author_id is not null;
  notif_title := case when is_reply then 'Nova resposta' else 'Novo comentário' end;

  -- dono do post
  if post_author is not null and post_author is distinct from new.author_id then
    begin
      insert into public.notifications (
        user_id, type, title, body, href, actor_id, actor_name, dedupe_key
      ) values (
        post_author,
        'comment',
        notif_title,
        new.author_name ||
          case when is_reply then ' respondeu no seu post' else ' comentou no seu post' end ||
          case when length(trim(new.content)) > 0 then ': “' || left(trim(new.content), 48) || '”'
               when new.gif_url is not null then ': enviou um GIF'
               else '' end,
        '/app?post=' || new.post_id::text || '&comment=' || new.id::text,
        new.author_id,
        new.author_name,
        'comment:' || new.id::text || ':' || post_author::text
      );
    exception when unique_violation then null;
    end;
  end if;

  -- quem foi respondido
  if is_reply
     and new.reply_to_author_id is distinct from new.author_id
     and new.reply_to_author_id is distinct from post_author then
    begin
      insert into public.notifications (
        user_id, type, title, body, href, actor_id, actor_name, dedupe_key
      ) values (
        new.reply_to_author_id,
        'comment',
        'Nova resposta',
        new.author_name || ' respondeu seu comentário' ||
          case when length(trim(new.content)) > 0 then ': “' || left(trim(new.content), 48) || '”'
               when new.gif_url is not null then ': enviou um GIF'
               else '' end,
        '/app?post=' || new.post_id::text || '&comment=' || new.id::text,
        new.author_id,
        new.author_name,
        'comment-reply:' || new.id::text || ':' || new.reply_to_author_id::text
      );
    exception when unique_violation then null;
    end;
  end if;

  -- atualiza contador
  update public.posts
  set comments_count = (select count(*)::int from public.comments c where c.post_id = new.post_id)
  where id = new.post_id;

  return new;
end;
$$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

create or replace function public.bump_comment_count_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set comments_count = (select count(*)::int from public.comments c where c.post_id = old.post_id)
  where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists comments_count_delete on public.comments;
create trigger comments_count_delete
  after delete on public.comments
  for each row execute function public.bump_comment_count_on_delete();

-- ─── Realtime (feed multi-user + notifs + comments) ────────────────────────
-- No Dashboard: Database → Publications → supabase_realtime → add tables
-- Este bloco tenta adicionar via SQL (idempotente).
do $$
begin
  begin
    alter publication supabase_realtime add table public.posts;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.comments;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;

-- REPLICA IDENTITY FULL ajuda DELETE realtime a trazer colunas antigas
alter table public.posts replica identity full;
alter table public.comments replica identity full;
alter table public.notifications replica identity full;
