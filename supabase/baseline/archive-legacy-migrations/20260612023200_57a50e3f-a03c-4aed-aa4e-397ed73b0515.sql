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
  )
  SELECT
    j.jobname,
    j.schedule,
    NULL::timestamptz AS last_run_at,
    NULL::text AS last_status,
    NULL::integer AS last_duration_ms,
    CASE j.jobname
      WHEN 'weekly-competitor-scrape' THEN
        (SELECT count(*) FROM public.competitor_designers WHERE created_at >= now() - interval '7 days')
        + (SELECT count(*) FROM public.auction_benchmarks WHERE created_at >= now() - interval '7 days')
      WHEN 'monthly-similarweb-scrape' THEN
        (SELECT count(*) FROM public.competitor_traffic WHERE month >= (now() - interval '7 days')::date)
      WHEN 'scrape-products-daily' THEN
        (SELECT count(*) FROM public.trade_products WHERE updated_at >= now() - interval '7 days')
      ELSE NULL
    END AS rows_7d,
    CASE j.jobname
      WHEN 'weekly-competitor-scrape' THEN
        (SELECT count(*) FROM public.competitor_designers WHERE created_at >= now() - interval '30 days')
        + (SELECT count(*) FROM public.auction_benchmarks WHERE created_at >= now() - interval '30 days')
      WHEN 'monthly-similarweb-scrape' THEN
        (SELECT count(*) FROM public.competitor_traffic WHERE month >= (now() - interval '30 days')::date)
      WHEN 'scrape-products-daily' THEN
        (SELECT count(*) FROM public.trade_products WHERE updated_at >= now() - interval '30 days')
      ELSE NULL
    END AS rows_30d,
    CASE j.jobname
      WHEN 'weekly-competitor-scrape' THEN 'competitor designers + auction lots'
      WHEN 'monthly-similarweb-scrape' THEN 'traffic rows'
      WHEN 'scrape-products-daily' THEN 'products updated'
      ELSE NULL
    END AS rows_label
  FROM cron.job j
  CROSS JOIN admin_check a
  WHERE a.is_admin
  ORDER BY j.jobname;
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_jobs_summary() TO authenticated;