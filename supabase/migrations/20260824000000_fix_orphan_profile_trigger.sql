-- Corrige el trigger handle_new_user() para que sea robusto contra
-- perfiles huerfanos (un perfil cuyo auth.users correspondiente ya no
-- existe, pero cuyo email sigue ocupando la fila en profiles).
--
-- Bug real encontrado en produccion: cuando alguien intentaba
-- registrarse con un email que ya tenia un perfil huerfano (mismo
-- email, id distinto — por ejemplo, si el usuario de auth.users fue
-- eliminado en algun momento sin arrastrar su perfil), el INSERT del
-- trigger violaba la restriccion unica de profiles.email, abortando
-- TODA la transaccion de signup (incluida la creacion del nuevo
-- usuario en auth.users). El sintoma visible era el mensaje generico
-- "No se ha podido verificar tu cuenta" en el onboarding, ya que
-- signUp() nunca llegaba a completarse con exito.
--
-- Dado que auth.users.email ya tiene su propia restriccion unica
-- nativa, si un email nuevo en auth.users choca con un email ya
-- presente en profiles bajo OTRO id, ese perfil viejo solo puede ser
-- huerfano por definicion — es seguro eliminarlo automaticamente
-- antes de insertar el nuevo, sin ningun riesgo de borrar un perfil
-- reals en uso.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.profiles
  where email = coalesce(new.email, '') and id <> new.id;

  insert into public.profiles (
    id,
    email,
    plan,
    trial_ends_at,
    provider,
    display_name,
    avatar_url
  )
  values (
    new.id,
    coalesce(new.email, ''),
    'trial',
    now() + interval '24 hours',
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;
