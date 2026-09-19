-- Read-only SQL helper for the security scanner. Service-role only — EXECUTE
-- is REVOKEd from anon/authenticated/PUBLIC so even if the function name
-- leaks, end users cannot run it.
CREATE OR REPLACE FUNCTION public.scan_sec_query(_sql text)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, information_schema
AS $$
BEGIN
  -- Hard guards: only allow read-only catalog queries.
  IF _sql ~* '\\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|comment|copy|do|call|vacuum|analyze|reindex|cluster|reset|set\\s+role|set\\s+session)\\b' THEN
    RAISE EXCEPTION 'scan_sec_query: write/DDL statements rejected';
  END IF;
  IF _sql !~* '^\\s*(with|select)\\b' THEN
    RAISE EXCEPTION 'scan_sec_query: only WITH/SELECT allowed';
  END IF;
  RETURN QUERY EXECUTE 'select row_to_json(t) from (' || _sql || ') t';
END;
$$;

REVOKE ALL ON FUNCTION public.scan_sec_query(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.scan_sec_query(text) FROM anon;
REVOKE ALL ON FUNCTION public.scan_sec_query(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.scan_sec_query(text) TO service_role;

-- Ensure pg_cron + pg_net are available (they already are for this project,
-- but make the migration idempotent across environments).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Remove any prior schedule for this job, then schedule every 4 hours.
DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'scan-security-invariants-4h' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'scan-security-invariants-4h',
  '7 */4 * * *',  -- :07 every 4 hours (off-peak relative to other crons)
  $$
  SELECT net.http_post(
    url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/scan-security-invariants',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);