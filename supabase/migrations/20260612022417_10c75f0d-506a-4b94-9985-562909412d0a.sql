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
  WITH admin_check AS MATERIALIZED (
    SELECT public.has_role(auth.uid(), 'admin'::app_role) AS is_admin
  ), recent_runs AS (
    SELECT
      j.jobname,
      j.schedule,
      jrd.start_time,
      jrd.end_time,
      jrd.status,
      jrd.return_message
    FROM cron.job_run_details jrd
    JOIN cron.job j USING (jobid)
    CROSS JOIN admin_check a
    WHERE a.is_admin
    ORDER BY jrd.runid DESC
    LIMIT GREATEST(1, LEAST(_limit, 100))
  )
  SELECT
    r.jobname,
    r.schedule,
    r.start_time,
    r.end_time,
    GREATEST(0, EXTRACT(EPOCH FROM (r.end_time - r.start_time)) * 1000)::int AS duration_ms,
    r.status,
    LEFT(COALESCE(r.return_message, ''), 240) AS return_message,
    (
      SELECT resp.status_code
      FROM public.cron_http_call_log l
      JOIN net._http_response resp ON resp.id = l.request_id
      WHERE l.jobname = r.jobname
        AND resp.created BETWEEN r.start_time - interval '5 seconds' AND r.end_time + interval '10 minutes'
      ORDER BY resp.created DESC
      LIMIT 1
    ) AS http_status_code
  FROM recent_runs r
  ORDER BY r.start_time DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_run_history(integer) TO authenticated;

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
  WITH admin_check AS MATERIALIZED (
    SELECT public.has_role(auth.uid(), 'admin'::app_role) AS is_admin
  ), latest_runids AS (
    SELECT jrd.jobid, max(jrd.runid) AS runid
    FROM cron.job_run_details jrd
    GROUP BY jrd.jobid
  ), last_runs AS (
    SELECT
      j.jobname,
      j.schedule,
      jrd.start_time,
      jrd.end_time,
      jrd.status
    FROM cron.job j
    CROSS JOIN admin_check a
    LEFT JOIN latest_runids lr USING (jobid)
    LEFT JOIN cron.job_run_details jrd ON jrd.runid = lr.runid
    WHERE a.is_admin
  )
  SELECT
    lr.jobname,
    lr.schedule,
    lr.start_time,
    lr.status,
    CASE
      WHEN lr.start_time IS NULL OR lr.end_time IS NULL THEN NULL
      ELSE GREATEST(0, EXTRACT(EPOCH FROM (lr.end_time - lr.start_time)) * 1000)::int
    END AS last_duration_ms,
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
  ORDER BY lr.jobname;
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_jobs_summary() TO authenticated;