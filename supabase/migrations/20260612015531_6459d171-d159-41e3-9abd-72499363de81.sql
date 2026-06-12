
-- Last 50 runs across all cron jobs (admin only)
CREATE OR REPLACE FUNCTION public.get_cron_run_history(_limit integer DEFAULT 50)
RETURNS TABLE (
  jobname text,
  schedule text,
  start_time timestamptz,
  end_time timestamptz,
  duration_ms integer,
  status text,
  return_message text,
  http_status_code integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
  SELECT
    j.jobname,
    j.schedule,
    jrd.start_time,
    jrd.end_time,
    GREATEST(0, EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) * 1000)::int AS duration_ms,
    jrd.status,
    LEFT(COALESCE(jrd.return_message, ''), 240) AS return_message,
    (
      SELECT r.status_code
      FROM public.cron_http_call_log l
      JOIN net._http_response r ON r.id = l.request_id
      WHERE l.jobname = j.jobname
        AND r.created BETWEEN jrd.start_time - interval '5 seconds' AND jrd.end_time + interval '10 minutes'
      ORDER BY r.created DESC
      LIMIT 1
    ) AS http_status_code
  FROM cron.job_run_details jrd
  JOIN cron.job j USING (jobid)
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY jrd.start_time DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_run_history(integer) TO authenticated;

-- Per-job summary: last run + rolling row counts (admin only)
CREATE OR REPLACE FUNCTION public.get_cron_jobs_summary()
RETURNS TABLE (
  jobname text,
  schedule text,
  last_run_at timestamptz,
  last_status text,
  last_duration_ms integer,
  rows_7d bigint,
  rows_30d bigint,
  rows_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
  WITH last_runs AS (
    SELECT DISTINCT ON (j.jobname)
      j.jobname,
      j.schedule,
      jrd.start_time,
      jrd.status,
      GREATEST(0, EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) * 1000)::int AS dur
    FROM cron.job j
    LEFT JOIN cron.job_run_details jrd USING (jobid)
    ORDER BY j.jobname, jrd.start_time DESC NULLS LAST
  )
  SELECT
    lr.jobname,
    lr.schedule,
    lr.start_time,
    lr.status,
    lr.dur,
    CASE lr.jobname
      WHEN 'weekly-competitor-scrape' THEN
        (SELECT count(*) FROM public.competitor_designers WHERE created_at >= now() - interval '7 days')
        + (SELECT count(*) FROM public.auction_benchmarks WHERE created_at >= now() - interval '7 days')
      WHEN 'monthly-similarweb-scrape' THEN
        (SELECT count(*) FROM public.competitor_traffic WHERE month >= (now() - interval '7 days')::date)
      WHEN 'scrape-products-daily' THEN
        (SELECT count(*) FROM public.trade_products WHERE updated_at >= now() - interval '7 days')
      ELSE NULL
    END AS rows_7d,
    CASE lr.jobname
      WHEN 'weekly-competitor-scrape' THEN
        (SELECT count(*) FROM public.competitor_designers WHERE created_at >= now() - interval '30 days')
        + (SELECT count(*) FROM public.auction_benchmarks WHERE created_at >= now() - interval '30 days')
      WHEN 'monthly-similarweb-scrape' THEN
        (SELECT count(*) FROM public.competitor_traffic WHERE month >= (now() - interval '30 days')::date)
      WHEN 'scrape-products-daily' THEN
        (SELECT count(*) FROM public.trade_products WHERE updated_at >= now() - interval '30 days')
      ELSE NULL
    END AS rows_30d,
    CASE lr.jobname
      WHEN 'weekly-competitor-scrape' THEN 'competitor designers + auction lots'
      WHEN 'monthly-similarweb-scrape' THEN 'traffic rows'
      WHEN 'scrape-products-daily' THEN 'products updated'
      ELSE NULL
    END AS rows_label
  FROM last_runs lr
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_jobs_summary() TO authenticated;
