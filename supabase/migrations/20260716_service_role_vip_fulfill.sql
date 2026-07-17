-- =============================================================================
-- Fulfillment Pay → Forum: service_role pode setar is_vip / role (webhook).
-- O trigger P1.h bloqueava qualquer update sem is_admin(); service role
-- não tem auth.uid() de admin, então o grant VIP nunca funcionaria.
-- =============================================================================

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  -- Webhook / backend com SUPABASE_SERVICE_ROLE_KEY
  jwt_role := coalesce(
    auth.jwt() ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  );
  if jwt_role = 'service_role' then
    return new;
  end if;

  -- Admin real (profiles.role)
  if public.is_admin() then
    return new;
  end if;

  -- Usuário comum: trava privilégios
  new.role := old.role;
  new.is_vip := old.is_vip;
  new.is_verified := old.is_verified;

  return new;
end;
$$;

comment on function public.profiles_guard_privileged_columns() is
  'Bloqueia self-elevate; permite is_admin() e service_role (Pay fulfillment).';
