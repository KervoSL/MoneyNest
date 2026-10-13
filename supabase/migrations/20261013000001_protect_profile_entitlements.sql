-- H-01: un usuario autenticado no debe poder modificar sus propios derechos
-- (plan, pruebas, cliente de Stripe...) escribiendo directamente en `profiles`
-- con la clave anon + su JWT. Solo service_role y las funciones SECURITY DEFINER
-- (que se ejecutan como propietario) pueden cambiar estas columnas.
--
-- Columnas que el cliente SÍ puede seguir escribiendo: display_name, avatar_url,
-- session_id, updated_at (y last_sync_at). No hay otras escrituras directas
-- desde la app (js/supabase-auth.js:146 y updateProfile sin llamadores).

create or replace function public.protect_profile_entitlements()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- current_user es el rol de la sesión: 'authenticated'/'anon' para PostgREST
  -- con JWT de usuario; 'service_role' para Edge Functions; el propietario
  -- dentro de funciones SECURITY DEFINER.
  if current_user in ('authenticated', 'anon') then
    if new.id                 is distinct from old.id
    or new.email              is distinct from old.email
    or new.plan               is distinct from old.plan
    or new.trial_ends_at      is distinct from old.trial_ends_at
    or new.pro_trial_ends_at  is distinct from old.pro_trial_ends_at
    or new.pro_trial_used     is distinct from old.pro_trial_used
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.cloud_enabled      is distinct from old.cloud_enabled
    then
      raise exception 'protected_profile_column' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_entitlements on public.profiles;
create trigger trg_protect_profile_entitlements
  before update on public.profiles
  for each row execute function public.protect_profile_entitlements();

-- El nombre del trigger empieza por "trg_p" y se ejecuta antes que
-- trg_sync_cloud_enabled (orden alfabético), así que cualquier intento de
-- cambiar `plan` falla antes de que se recalcule cloud_enabled.

-- Defensa adicional: la política de UPDATE también debe validar la fila nueva.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
