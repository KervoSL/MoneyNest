-- Columna necesaria para el sistema de limite de dispositivos por plan
-- (Local = 1 dispositivo, Pro = varios) — se referenciaba desde
-- signUp()/signIn() pero nunca se creo la migracion correspondiente.
alter table public.profiles add column if not exists session_id text;
