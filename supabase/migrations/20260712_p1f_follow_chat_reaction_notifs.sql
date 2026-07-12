-- =============================================================================
-- P1.f · Follow multi-user + notif de follow + reações no chat (notif + RLS)
-- =============================================================================
-- Aplicar no SQL Editor APÓS P1.e
-- · Tabela follows (grafo social real)
-- · Trigger: "X começou a te seguir"
-- · RPC toggle_chat_reaction: qualquer participante reage + notifica o autor
-- =============================================================================

-- ─── Follows ────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index if not exists follows_following_idx
  on public.follows (following_id, created_at desc);

create index if not exists follows_follower_idx
  on public.follows (follower_id, created_at desc);

alter table public.follows enable row level security;

drop policy if exists "follows_select_auth" on public.follows;
create policy "follows_select_auth"
  on public.follows for select
  using (auth.uid() is not null);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
  on public.follows for delete
  using (auth.uid() = follower_id);

grant select, insert, delete on public.follows to authenticated;

-- Notifica o seguido quando alguém começa a seguir
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
begin
  select coalesce(p.name, 'Alguém') into actor
  from public.profiles p
  where p.id = new.follower_id;

  begin
    insert into public.notifications (
      user_id, type, title, body, href, actor_id, actor_name, dedupe_key
    ) values (
      new.following_id,
      'follow',
      'Novo seguidor',
      actor || ' começou a te seguir',
      '/app/u/' || new.follower_id::text,
      new.follower_id,
      actor,
      'follow:' || new.follower_id::text || ':' || new.following_id::text
    );
  exception when unique_violation then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists follow_notify on public.follows;
create trigger follow_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- Realtime follows (contagens multi-user)
do $$
begin
  begin
    alter publication supabase_realtime add table public.follows;
  exception when duplicate_object then
    null;
  end;
end $$;

-- ─── Chat: reagir (qualquer participante) + notificar autor ─────────────────
-- Substitui update direto (RLS só deixa o autor atualizar a própria msg).
create or replace function public.toggle_chat_reaction(
  p_message_id uuid,
  p_emoji text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  msg public.chat_messages;
  reactions jsonb;
  key text;
  arr jsonb;
  cleaned jsonb;
  had boolean := false;
  actor text;
  preview text;
  href text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  p_emoji := trim(coalesce(p_emoji, ''));
  if length(p_emoji) = 0 or length(p_emoji) > 32 then
    raise exception 'emoji invalid';
  end if;

  select * into msg
  from public.chat_messages
  where id = p_message_id
  for update;

  if not found then
    raise exception 'message not found';
  end if;

  -- Mesma regra de visibilidade do SELECT
  if msg.channel_id like 'dm_%' then
    if not (
      msg.channel_id like 'dm_' || uid::text || '__%'
      or msg.channel_id like 'dm_%__' || uid::text
    ) then
      raise exception 'forbidden';
    end if;
  elsif auth.uid() is null then
    raise exception 'forbidden';
  end if;

  reactions := coalesce(msg.reactions, '{}'::jsonb);

  -- Já tinha este emoji?
  if reactions ? p_emoji then
    select exists (
      select 1
      from jsonb_array_elements_text(reactions -> p_emoji) as t(x)
      where t.x = uid::text
    ) into had;
  end if;

  -- Remove o usuário de TODOS os emojis
  for key in select jsonb_object_keys(reactions)
  loop
    select coalesce(
      jsonb_agg(to_jsonb(t.x)),
      '[]'::jsonb
    )
    into cleaned
    from jsonb_array_elements_text(reactions -> key) as t(x)
    where t.x is distinct from uid::text;

    if cleaned = '[]'::jsonb or cleaned is null then
      reactions := reactions - key;
    else
      reactions := jsonb_set(reactions, array[key], cleaned, true);
    end if;
  end loop;

  -- Toggle: se não tinha, adiciona
  if not had then
    arr := coalesce(reactions -> p_emoji, '[]'::jsonb);
    arr := arr || to_jsonb(uid::text);
    reactions := jsonb_set(reactions, array[p_emoji], arr, true);
  end if;

  update public.chat_messages
  set reactions = reactions
  where id = p_message_id;

  -- Notifica o autor só ao ADICIONAR reação (não self, não remoção)
  if not had and msg.author_id is distinct from uid then
    select coalesce(p.name, 'Alguém') into actor
    from public.profiles p
    where p.id = uid;

    preview := case
      when length(trim(coalesce(msg.content, ''))) > 0
        then left(trim(msg.content), 48)
      when msg.media_kind = 'image' then 'foto'
      when msg.media_kind = 'video' then 'vídeo'
      when msg.media_kind = 'audio' then 'áudio'
      when msg.media_kind = 'sticker' then 'figurinha'
      when msg.media_kind = 'gif' then 'GIF'
      when msg.shared_post_id is not null then 'post encaminhado'
      else 'mensagem'
    end;

    if msg.channel_id like 'dm_%' then
      href := '/app/chat?dm=' || uid::text;
    else
      href := '/app/chat?channel=' || msg.channel_id;
    end if;

    begin
      insert into public.notifications (
        user_id, type, title, body, href, actor_id, actor_name, dedupe_key
      ) values (
        msg.author_id,
        'reaction',
        'Reação no bate-papo',
        actor || ' reagiu com ' || p_emoji || ' à sua mensagem' ||
          case
            when preview is not null and preview <> '' then ': “' || preview || '”'
            else ''
          end,
        href,
        uid,
        actor,
        'chat-react:' || msg.id::text || ':' || uid::text || ':' || p_emoji
      );
    exception when unique_violation then
      null;
    end;
  end if;

  return reactions;
end;
$$;

grant execute on function public.toggle_chat_reaction(uuid, text) to authenticated;
