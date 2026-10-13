# Pruebas de la fase 1 de seguridad

Sin red ni claves reales (todo con mocks / base de datos en memoria).

- `phase1_functions_test.ts` — H-02, H-03, H-04, H-05, H-09 (Edge Functions con `fetch` simulado).
  `deno run -A --no-config --node-modules-dir=none supabase/tests/phase1_functions_test.ts`
- `phase1_profiles_trigger_test.mjs` — H-01 (trigger/RLS de `profiles` sobre PGlite).
  `npm i --no-save @electric-sql/pglite && node supabase/tests/phase1_profiles_trigger_test.mjs`
