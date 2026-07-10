-- Handle público (@username) nos perfis
-- Rode no SQL Editor do Supabase se ainda não aplicou.

alter table public.profiles
  add column if not exists username text;

-- Preenche a partir da parte local do e-mail onde estiver vazio
update public.profiles
set username = lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9_]', '', 'g'))
where username is null or btrim(username) = '';

-- Garante mínimo de 3 chars
update public.profiles
set username = left(username || 'user', 24)
where length(username) < 3;

-- Resolve colisões simples com suffix do id
with dups as (
  select id, username,
    row_number() over (partition by username order by created_at) as rn
  from public.profiles
)
update public.profiles p
set username = left(p.username, 16) || '_' || substr(replace(p.id::text, '-', ''), 1, 6)
from dups d
where p.id = d.id and d.rn > 1;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username));

comment on column public.profiles.username is
  'Handle público (@username). E-mail permanece privado no auth/profile owner.';
