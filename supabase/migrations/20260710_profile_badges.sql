-- Emblemas / conquistas no perfil
-- Rode no Supabase SQL Editor se ainda não aplicou.

alter table public.profiles
  add column if not exists badges_unlocked jsonb not null default '[]'::jsonb;

alter table public.profiles
  add column if not exists badge_equipped text null;

comment on column public.profiles.badges_unlocked is
  'IDs de emblemas desbloqueados (array JSON de strings)';
comment on column public.profiles.badge_equipped is
  'ID do emblema fixo exibido no perfil (apenas 1)';

-- Conferência
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('badges_unlocked', 'badge_equipped');
