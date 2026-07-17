-- Status de conta (ban/suspend) para sync com Nullysh Pay
alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  add column if not exists status_reason text;

alter table public.profiles
  add column if not exists status_updated_at timestamptz;

comment on column public.profiles.account_status is
  'active | suspended | banned — ban/suspend dispara webhook para Nullysh Pay';

-- Usuário não altera o próprio status privilegiado
-- (ajuste fino de RLS fica a cargo de políticas admin existentes)
