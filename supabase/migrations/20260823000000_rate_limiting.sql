-- Rate limiting real, del lado del servidor, compartido entre todas
-- las invocaciones de Edge Functions (a diferencia del rate limiting
-- actual del frontend, que vive solo en memoria del navegador y se
-- resetea con cada recarga de pagina).
create table if not exists public.rate_limits (
  rl_key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

-- Nadie tiene acceso directo a esta tabla salvo el service role (las
-- Edge Functions la usan con la service key) -- RLS deniega todo por
-- defecto al no crear ninguna policy.
alter table public.rate_limits enable row level security;

-- Verifica e incrementa atomicamente el contador de un key dado. Si la
-- ventana de tiempo ya expiro, la reinicia. Devuelve true si la
-- peticion esta permitida, false si se supero el limite.
create or replace function public.check_rate_limit(
  p_key text,
  p_max_attempts integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rate_limits;
begin
  insert into public.rate_limits (rl_key, count, window_start)
  values (p_key, 1, now())
  on conflict (rl_key) do update set
    count = case
      when now() - public.rate_limits.window_start > make_interval(secs => p_window_seconds)
        then 1
      else public.rate_limits.count + 1
    end,
    window_start = case
      when now() - public.rate_limits.window_start > make_interval(secs => p_window_seconds)
        then now()
      else public.rate_limits.window_start
    end
  returning * into v_row;

  return v_row.count <= p_max_attempts;
end;
$$;

-- Limpieza periodica opcional: elimina entradas viejas para que la
-- tabla no crezca indefinidamente (una ventana maxima razonable de 1
-- dia cubre todos los usos actuales).
create or replace function public.cleanup_old_rate_limits() returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;
