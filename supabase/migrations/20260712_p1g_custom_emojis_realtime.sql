-- =============================================================================
-- P1.g · Realtime no catálogo de emojis custom (view multi-user)
-- =============================================================================
-- Tabela custom_emojis já existe (init). Garante realtime para free/VIP
-- verem novos emojis sem reload.
-- =============================================================================

do $$
begin
  begin
    alter publication supabase_realtime add table public.custom_emojis;
  exception when duplicate_object then
    null;
  end;
end $$;

-- Reforça SELECT público (todos visualizam; create continua VIP via RLS)
drop policy if exists "emojis_select_all" on public.custom_emojis;
create policy "emojis_select_all"
  on public.custom_emojis for select
  using (true);

grant select on public.custom_emojis to authenticated, anon;
grant insert, delete on public.custom_emojis to authenticated;
