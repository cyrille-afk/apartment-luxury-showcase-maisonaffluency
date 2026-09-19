CREATE TABLE IF NOT EXISTS public.cron_http_call_log (
  request_id bigint PRIMARY KEY,
  jobname text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.cron_http_call_log TO service_role;

ALTER TABLE public.cron_http_call_log ENABLE ROW LEVEL SECURITY;
-- service_role bypasses RLS; no other roles need access.

CREATE INDEX IF NOT EXISTS cron_http_call_log_jobname_created_idx
  ON public.cron_http_call_log (jobname, created_at DESC);

-- Update failure helper to use the call log instead of the (purged) net queue
CREATE OR REPLACE FUNCTION public.get_recent_scrape_failures(since_minutes int DEFAULT 60)
RETURNS TABLE (
  id bigint,
  status_code int,
  body text,
  created timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, net
AS $$
  SELECT r.id, r.status_code, left(r.content::text, 500) AS body, r.created
  FROM net._http_response r
  JOIN public.cron_http_call_log l ON l.request_id = r.id
  WHERE l.jobname = 'scrape-products-daily'
    AND r.created >= now() - make_interval(mins => since_minutes)
    AND (r.status_code IS NULL OR r.status_code < 200 OR r.status_code >= 300)
  ORDER BY r.created DESC
$$;

REVOKE ALL ON FUNCTION public.get_recent_scrape_failures(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_scrape_failures(int) TO service_role;