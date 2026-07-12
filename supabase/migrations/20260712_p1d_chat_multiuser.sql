-- =============================================================================
-- P1.d · Chat multi-user (canais públicos + DM + mídia + notif DM)
-- =============================================================================
-- Aplicar no SQL Editor APÓS P1.b / P1.c
-- =============================================================================

-- ─── Colunas de mídia / reações / post compartilhado ───────────────────────
alter table public.chat_messages
  add column if not exists shared_post_id text;

alter table public.chat_messages
  add column if not exists media_kind text;

alter table public.chat_messages
  add column if not exists media_url text;

alter table public.chat_messages
  add column if not exists media_mime text;

alter table public.chat_messages
  add column if not exists media_duration numeric;

alter table public.chat_messages
  add column if not exists media_thumb_url text;

alter table public.chat_messages
  add column if not exists media_width int;

alter table public.chat_messages
  add column if not exists media_height int;

alter table public.chat_messages
  add column if not exists reactions jsonb not null default '{}'::jsonb;

-- content pode ser vazio se só houver mídia
alter table public.chat_messages
  alter column content set default '';

-- ─── RLS: salas públicas p/ autenticados; DM só entre participantes ────────
drop policy if exists "chat_select_auth" on public.chat_messages;
drop policy if exists "chat_select_visible" on public.chat_messages;
create policy "chat_select_visible"
  on public.chat_messages for select
  using (
    auth.uid() is not null
    and (
      -- sala pública (#lobby, #ajuda, …)
      channel_id not like 'dm_%'
      -- DM em que o usuário participa: dm_{uuid}__{uuid}
      or channel_id like 'dm_' || auth.uid()::text || '__%'
      or channel_id like 'dm_%__' || auth.uid()::text
    )
  );

drop policy if exists "chat_insert_auth" on public.chat_messages;
create policy "chat_insert_auth"
  on public.chat_messages for insert
  with check (
    auth.uid() is not null
    and auth.uid() = author_id
    and (
      channel_id not like 'dm_%'
      or channel_id like 'dm_' || auth.uid()::text || '__%'
      or channel_id like 'dm_%__' || auth.uid()::text
    )
  );

drop policy if exists "chat_delete_own" on public.chat_messages;
create policy "chat_delete_own"
  on public.chat_messages for delete
  using (auth.uid() = author_id or public.is_admin());

drop policy if exists "chat_update_own" on public.chat_messages;
create policy "chat_update_own"
  on public.chat_messages for update
  using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

grant select, insert, update, delete on public.chat_messages to authenticated;

-- ─── Notificação de DM (multi-user) ────────────────────────────────────────
create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rest text;
  id1 text;
  id2 text;
  peer uuid;
  preview text;
  sep int;
begin
  -- só DM
  if new.channel_id is null or new.channel_id not like 'dm_%' then
    return new;
  end if;

  rest := substring(new.channel_id from 4); -- após "dm_"
  sep := position('__' in rest);
  if sep <= 0 then
    return new;
  end if;

  id1 := left(rest, sep - 1);
  id2 := substring(rest from sep + 2);

  if id1 = new.author_id::text then
    peer := id2::uuid;
  elsif id2 = new.author_id::text then
    peer := id1::uuid;
  else
    return new;
  end if;

  if peer is null or peer = new.author_id then
    return new;
  end if;

  preview := case
    when length(trim(coalesce(new.content, ''))) > 0
      then left(trim(new.content), 60)
    when new.shared_post_id is not null then 'encaminhou um post'
    when new.media_kind = 'image' then 'enviou uma foto'
    when new.media_kind = 'video' then 'enviou um vídeo'
    when new.media_kind = 'audio' then 'enviou um áudio'
    when new.media_kind = 'sticker' then 'enviou uma figurinha'
    when new.media_kind = 'gif' then 'enviou um GIF'
    else 'enviou uma mensagem'
  end;

  begin
    insert into public.notifications (
      user_id, type, title, body, href, actor_id, actor_name, dedupe_key
    ) values (
      peer,
      'dm',
      'Nova mensagem',
      new.author_name || ': ' || preview,
      '/app/chat?dm=' || new.author_id::text,
      new.author_id,
      new.author_name,
      'dm:' || new.id::text || ':' || peer::text
    );
  exception when unique_violation then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists chat_notify_dm on public.chat_messages;
create trigger chat_notify_dm
  after insert on public.chat_messages
  for each row execute function public.notify_on_chat_message();

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;

alter table public.chat_messages replica identity full;
