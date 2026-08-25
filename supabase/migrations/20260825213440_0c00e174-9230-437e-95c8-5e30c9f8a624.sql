CREATE OR REPLACE FUNCTION public.acquire_ingestion_lease(_owner text, _minutes integer DEFAULT 5)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated integer;
BEGIN
  UPDATE public.ingestion_job_state
     SET lease_until = now() + make_interval(mins => _minutes),
         lease_owner = _owner,
         last_run_at = now()
   WHERE id
     AND (lease_until IS NULL OR lease_until < now());
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_ingestion_lease(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_ingestion_lease(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.release_ingestion_lease(_owner text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ingestion_job_state
     SET lease_until = NULL, lease_owner = NULL
   WHERE id AND lease_owner = _owner;
$$;

REVOKE ALL ON FUNCTION public.release_ingestion_lease(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_ingestion_lease(text) TO service_role;