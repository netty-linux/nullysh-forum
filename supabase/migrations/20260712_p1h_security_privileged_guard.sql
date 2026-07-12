-- =============================================================================
-- P1.h · Segurança: impedir self-elevate de is_vip / role / is_verified
-- =============================================================================
-- RLS em profiles permite UPDATE na própria linha, mas NÃO restringe colunas.
-- Um cliente malicioso poderia enviar { is_vip: true, role: 'admin' }.
-- Este trigger restaura campos privilegiados salvo se o caller for admin.
-- =============================================================================

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin real (profiles.role) pode alterar qualquer coluna privilegiada
  if public.is_admin() then
    return new;
  end if;

  -- Usuário comum: trava privilégios no valor anterior
  new.role := old.role;
  new.is_vip := old.is_vip;
  new.is_verified := old.is_verified;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row
  execute function public.profiles_guard_privileged_columns();

comment on function public.profiles_guard_privileged_columns() is
  'Bloqueia mass-assignment de is_vip/role/is_verified por usuários não-admin';
