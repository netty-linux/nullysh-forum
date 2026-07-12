-- =============================================================================
-- P1.c · Dislike, repost e curtida de comentário (multi-user + notificações)
-- =============================================================================
-- Aplicar no SQL Editor APÓS 20260712_p1b_social_interactions.sql
-- =============================================================================

-- ─── Posts: disliked_by + contador ─────────────────────────────────────────
alter table public.posts
  add column if not exists disliked_by uuid[] not null default '{}';

alter table public.posts
  add column if not exists dislikes int not null default 0;

-- ─── Reposts ───────────────────────────────────────────────────────────────
create table if not exists public.post_reposts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null default '',
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists post_reposts_user_idx
  on public.post_reposts (user_id, created_at desc);

create index if not exists post_reposts_post_idx
  on public.post_reposts (post_id);

alter table public.post_reposts enable row level security;

drop policy if exists "post_reposts_select_all" on public.post_reposts;
create policy "post_reposts_select_all"
  on public.post_reposts for select using (true);

drop policy if exists "post_reposts_insert_own" on public.post_reposts;
create policy "post_reposts_insert_own"
  on public.post_reposts for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "post_reposts_delete_own" on public.post_reposts;
create policy "post_reposts_delete_own"
  on public.post_reposts for delete
  using (auth.uid() = user_id or public.is_admin());

grant select, insert, delete on public.post_reposts to authenticated;

-- ─── Atualiza toggle_post_like: ao curtir, remove dislike ──────────────────
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
      likes = likes + 1,
      -- mutual exclusive: tira dislike se existir
      disliked_by = array_remove(coalesce(disliked_by, '{}'), uid),
      dislikes = (
        select count(*)::int
        from unnest(array_remove(coalesce(disliked_by, '{}'), uid)) x
      )
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
        null;
      end;
    end if;
  end if;

  return row;
end;
$$;

grant execute on function public.toggle_post_like(uuid) to authenticated;

-- ─── RPC: toggle dislike ───────────────────────────────────────────────────
create or replace function public.toggle_post_dislike(p_post_id uuid)
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

  already := uid = any (coalesce(row.disliked_by, '{}'));

  if already then
    update public.posts
    set
      disliked_by = array_remove(coalesce(disliked_by, '{}'), uid),
      dislikes = greatest(0, dislikes - 1)
    where id = p_post_id
    returning * into row;
  else
    update public.posts
    set
      disliked_by = array_append(array_remove(coalesce(disliked_by, '{}'), uid), uid),
      dislikes = dislikes + 1,
      liked_by = array_remove(coalesce(liked_by, '{}'), uid),
      likes = (
        select count(*)::int
        from unnest(array_remove(coalesce(liked_by, '{}'), uid)) x
      )
    where id = p_post_id
    returning * into row;

    -- Notifica dono (não self-dislike)
    if row.author_id is distinct from uid then
      select coalesce(p.name, 'Alguém') into actor
      from public.profiles p where p.id = uid;

      begin
        insert into public.notifications (
          user_id, type, title, body, href, actor_id, actor_name, dedupe_key
        )
        values (
          row.author_id,
          'dislike',
          'Não gostou do seu post',
          actor || ' deu dislike no seu post' ||
            case
              when length(trim(coalesce(row.content, ''))) > 0
                then ': “' || left(trim(row.content), 48) || '”'
              else ''
            end,
          '/app?post=' || row.id::text,
          uid,
          actor,
          'dislike:' || row.id::text || ':' || uid::text
        );
      exception when unique_violation then
        null;
      end;
    end if;
  end if;

  return row;
end;
$$;

grant execute on function public.toggle_post_dislike(uuid) to authenticated;

-- ─── RPC: toggle curtida em comentário ─────────────────────────────────────
create or replace function public.toggle_comment_like(p_comment_id uuid)
returns public.comments
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.comments;
  already boolean;
  actor text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into c from public.comments where id = p_comment_id for update;
  if not found then
    raise exception 'comment not found';
  end if;

  already := uid = any (coalesce(c.liked_by, '{}'));

  if already then
    update public.comments
    set liked_by = array_remove(coalesce(liked_by, '{}'), uid)
    where id = p_comment_id
    returning * into c;
  else
    update public.comments
    set liked_by = array_append(array_remove(coalesce(liked_by, '{}'), uid), uid)
    where id = p_comment_id
    returning * into c;

    if c.author_id is distinct from uid then
      select coalesce(p.name, 'Alguém') into actor
      from public.profiles p where p.id = uid;

      begin
        insert into public.notifications (
          user_id, type, title, body, href, actor_id, actor_name, dedupe_key
        )
        values (
          c.author_id,
          'like',
          'Curtida no comentário',
          actor || ' curtiu seu comentário' ||
            case
              when length(trim(coalesce(c.content, ''))) > 0
                then ': “' || left(trim(c.content), 48) || '”'
              when c.gif_url is not null then ': enviou um GIF'
              else ''
            end,
          '/app?post=' || c.post_id::text || '&comment=' || c.id::text,
          uid,
          actor,
          'comment-like:' || c.id::text || ':' || uid::text
        );
      exception when unique_violation then
        null;
      end;
    end if;
  end if;

  return c;
end;
$$;

grant execute on function public.toggle_comment_like(uuid) to authenticated;

-- ─── RPC: toggle repost ────────────────────────────────────────────────────
create or replace function public.toggle_post_repost(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  post_row public.posts;
  actor text;
  existing_id uuid;
  new_id uuid;
  cnt int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into post_row from public.posts where id = p_post_id;
  if not found then
    raise exception 'post not found';
  end if;

  if post_row.author_id = uid then
    raise exception 'cannot repost own post';
  end if;

  select id into existing_id
  from public.post_reposts
  where post_id = p_post_id and user_id = uid;

  if existing_id is not null then
    delete from public.post_reposts where id = existing_id;
    select count(*)::int into cnt from public.post_reposts where post_id = p_post_id;
    return jsonb_build_object(
      'reposted', false,
      'count', cnt,
      'post_id', p_post_id,
      'user_id', uid
    );
  end if;

  select coalesce(p.name, 'Alguém') into actor
  from public.profiles p where p.id = uid;

  insert into public.post_reposts (post_id, user_id, user_name)
  values (p_post_id, uid, coalesce(actor, 'Membro'))
  returning id into new_id;

  begin
    insert into public.notifications (
      user_id, type, title, body, href, actor_id, actor_name, dedupe_key
    )
    values (
      post_row.author_id,
      'repost',
      'Repost',
      actor || ' repostou sua publicação',
      '/app?post=' || p_post_id::text,
      uid,
      actor,
      'repost:' || p_post_id::text || ':' || uid::text
    );
  exception when unique_violation then
    null;
  end;

  select count(*)::int into cnt from public.post_reposts where post_id = p_post_id;

  return jsonb_build_object(
    'reposted', true,
    'count', cnt,
    'id', new_id,
    'post_id', p_post_id,
    'user_id', uid,
    'user_name', actor,
    'created_at', now()
  );
end;
$$;

grant execute on function public.toggle_post_repost(uuid) to authenticated;

-- Realtime reposts
do $$
begin
  begin
    alter publication supabase_realtime add table public.post_reposts;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;

alter table public.post_reposts replica identity full;
