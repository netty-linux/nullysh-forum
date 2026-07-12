-- =============================================================================
-- P1.e · Receipts WhatsApp-style + cursor de leitura por sala
-- =============================================================================
-- ✓ enviado · ✓✓ entregue · ✓✓ azul = lido
-- Badge de não lidas por canal (salas + DM)
-- =============================================================================

alter table public.chat_messages
  add column if not exists delivered_to uuid[] not null default '{}';

alter table public.chat_messages
  add column if not exists read_by uuid[] not null default '{}';

-- Cursor: última vez que o user abriu/leu a sala
create table if not exists public.chat_read_cursors (
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel_id text not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

create index if not exists chat_read_cursors_user_idx
  on public.chat_read_cursors (user_id);

alter table public.chat_read_cursors enable row level security;

drop policy if exists "chat_cursors_select_own" on public.chat_read_cursors;
create policy "chat_cursors_select_own"
  on public.chat_read_cursors for select
  using (auth.uid() = user_id);

drop policy if exists "chat_cursors_upsert_own" on public.chat_read_cursors;
create policy "chat_cursors_insert_own"
  on public.chat_read_cursors for insert
  with check (auth.uid() = user_id);

drop policy if exists "chat_cursors_update_own" on public.chat_read_cursors;
create policy "chat_cursors_update_own"
  on public.chat_read_cursors for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.chat_read_cursors to authenticated;

-- ─── Entregue: quem recebeu o evento (não é o autor) ───────────────────────
create or replace function public.mark_chat_delivered(p_message_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_message_ids is null or array_length(p_message_ids, 1) is null then
    return;
  end if;

  update public.chat_messages m
  set delivered_to = case
    when uid = any (coalesce(m.delivered_to, '{}')) then m.delivered_to
    else array_append(coalesce(m.delivered_to, '{}'), uid)
  end
  where m.id = any (p_message_ids)
    and m.author_id is distinct from uid
    and not (uid = any (coalesce(m.delivered_to, '{}')));
end;
$$;

grant execute on function public.mark_chat_delivered(uuid[]) to authenticated;

-- ─── Lido: abriu a sala — marca mensagens de outros + atualiza cursor ──────
create or replace function public.mark_channel_read(p_channel_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_ts timestamptz := now();
begin
  if uid is null or p_channel_id is null or length(trim(p_channel_id)) = 0 then
    return;
  end if;

  -- cursor
  insert into public.chat_read_cursors (user_id, channel_id, last_read_at)
  values (uid, p_channel_id, now_ts)
  on conflict (user_id, channel_id)
  do update set last_read_at = excluded.last_read_at;

  -- marca entregue + lido em msgs de terceiros no canal
  update public.chat_messages m
  set
    delivered_to = case
      when uid = any (coalesce(m.delivered_to, '{}')) then m.delivered_to
      else array_append(coalesce(m.delivered_to, '{}'), uid)
    end,
    read_by = case
      when uid = any (coalesce(m.read_by, '{}')) then m.read_by
      else array_append(coalesce(m.read_by, '{}'), uid)
    end
  where m.channel_id = p_channel_id
    and m.author_id is distinct from uid
    and (
      not (uid = any (coalesce(m.read_by, '{}')))
      or not (uid = any (coalesce(m.delivered_to, '{}')))
    );
end;
$$;

grant execute on function public.mark_channel_read(text) to authenticated;

-- Realtime cursors (opcional) + mensagens já na publication
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_read_cursors;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;
