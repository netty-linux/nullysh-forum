-- =============================================================================
-- P1.j · Fix reações no bate-papo (DM + canais)
-- =============================================================================
-- Problemas do toggle_chat_reaction anterior:
-- 1) LIKE com '_' tratava underscore como wildcard → "forbidden" em alguns DMs
-- 2) INSERT em notifications fora de catch amplo → rollback da reação inteira
-- 3) Participação na DM agora valida com split explícito (dm_{a}__{b})
-- =============================================================================

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
  rest text;
  sep int;
  id1 text;
  id2 text;
  is_dm boolean;
  is_participant boolean := false;
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

  -- DM: dm_{uuidMenor}__{uuidMaior} — sem LIKE com '_' solto
  is_dm := left(msg.channel_id, 3) = 'dm_'
    and position('__' in msg.channel_id) > 3;

  if is_dm then
    rest := substring(msg.channel_id from 4); -- após "dm_"
    sep := position('__' in rest);
    if sep > 0 then
      id1 := left(rest, sep - 1);
      id2 := substring(rest from sep + 2);
      is_participant := (uid::text = id1 or uid::text = id2);
    end if;
    if not is_participant then
      raise exception 'forbidden';
    end if;
  end if;
  -- Canais públicos: qualquer autenticado pode reagir

  reactions := coalesce(msg.reactions, '{}'::jsonb);
  if jsonb_typeof(reactions) <> 'object' then
    reactions := '{}'::jsonb;
  end if;

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
      (
        select jsonb_agg(to_jsonb(t.x))
        from jsonb_array_elements_text(reactions -> key) as t(x)
        where t.x is distinct from uid::text
      ),
      '[]'::jsonb
    )
    into cleaned;

    if cleaned = '[]'::jsonb or cleaned is null then
      reactions := reactions - key;
    else
      reactions := jsonb_set(reactions, array[key], cleaned, true);
    end if;
  end loop;

  -- Toggle: se não tinha, adiciona
  if not had then
    arr := coalesce(reactions -> p_emoji, '[]'::jsonb);
    if jsonb_typeof(arr) <> 'array' then
      arr := '[]'::jsonb;
    end if;
    arr := arr || to_jsonb(uid::text);
    reactions := jsonb_set(reactions, array[p_emoji], arr, true);
  end if;

  update public.chat_messages
  set reactions = reactions
  where id = p_message_id;

  -- Notifica o autor só ao ADICIONAR (nunca aborta a reação se notif falhar)
  if not had and msg.author_id is distinct from uid then
    begin
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

      if is_dm then
        href := '/app/chat?dm=' || uid::text;
      else
        href := '/app/chat?channel=' || msg.channel_id;
      end if;

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
    exception when others then
      -- reação já persistida; notif é best-effort
      null;
    end;
  end if;

  return reactions;
end;
$$;

grant execute on function public.toggle_chat_reaction(uuid, text) to authenticated;

-- Também endurece a policy de SELECT/INSERT de DM (underscore literal)
drop policy if exists "chat_select_visible" on public.chat_messages;
create policy "chat_select_visible"
  on public.chat_messages for select
  using (
    auth.uid() is not null
    and (
      left(channel_id, 3) is distinct from 'dm_'
      or (
        -- dm_{me}__*
        channel_id like 'dm_' || auth.uid()::text || '\_\_%' escape '\'
        -- dm_*__{me}
        or channel_id like 'dm\_%\_\_' || auth.uid()::text escape '\'
      )
    )
  );

drop policy if exists "chat_insert_auth" on public.chat_messages;
create policy "chat_insert_auth"
  on public.chat_messages for insert
  with check (
    auth.uid() is not null
    and auth.uid() = author_id
    and (
      left(channel_id, 3) is distinct from 'dm_'
      or channel_id like 'dm_' || auth.uid()::text || '\_\_%' escape '\'
      or channel_id like 'dm\_%\_\_' || auth.uid()::text escape '\'
    )
  );
