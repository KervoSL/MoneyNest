# Pruebas de la fase 1 de seguridad

Sin red ni claves reales (todo con mocks / base de datos en memoria).

- `phase1_functions_test.ts` — H-02, H-03, H-04, H-05, H-09 (Edge Functions con `fetch` simulado).
  `deno run -A --no-config --node-modules-dir=none supabase/tests/phase1_functions_test.ts`
- `phase1_profiles_trigger_test.mjs` — H-01 (trigger/RLS de `profiles` sobre PGlite).
  `npm i --no-save @electric-sql/pglite && node supabase/tests/phase1_profiles_trigger_test.mjs`

## Fase 2
- `phase2_functions_test.ts` — H-11 (delete-account depura datos y borra el cliente de Stripe) y H-13 (check-license neutralizada). Mismo comando que la fase 1.
- `phase2_db_test.mjs` — H-17 (check_rate_limit solo para service_role) y H-11 (scrub_user_data, purge_old_telemetry).
- `../../tests/phase2_browser_test.py` — H-07/H-08/H-16 en navegador (Playwright): `cd moneynest_premium && python3 -m http.server 3300` y `python3 tests/phase2_browser_test.py`.
  Comprueba: sin consentimiento no se guarda identificador ni se envían eventos, «Aceptar»/«Rechazar» idénticos, no hay peticiones a Google Fonts/jsDelivr/cdnjs, y las URLs de error se envían sin query ni hash.

## Fase 4
- `phase4_functions_test.ts` — H-20 (suscripciones duplicadas) y H-12 (correo de soporte por variable). Mismo comando.
