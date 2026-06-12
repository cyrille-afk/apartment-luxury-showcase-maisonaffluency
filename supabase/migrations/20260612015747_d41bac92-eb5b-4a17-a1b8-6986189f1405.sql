
CREATE OR REPLACE FUNCTION public.get_cron_run_history(_limit integer DEFAULT 10)
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
  WITH ranked AS (
    SELECT
      j.jobname,
      j.schedule,
      jrd.start_time,
      jrd.end_time,
      jrd.status,
      jrd.return_message,
      row_number() OVER (PARTITION BY j.jobname ORDER BY jrd.start_time DESC) AS rn
    FROM cron.job_run_details jrd
    JOIN cron.job j USING (jobid)
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
  FROM ranked r
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
    AND r.rn <= GREATEST(1, LEAST(_limit, 50))
  ORDER BY r.start_time DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_run_history(integer) TO authenticated;
