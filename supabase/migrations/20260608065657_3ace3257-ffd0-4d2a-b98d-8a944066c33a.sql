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
  JOIN net.http_request_queue q ON q.id = r.id
  WHERE q.url LIKE '%/functions/v1/scrape-products%'
    AND r.created >= now() - make_interval(mins => since_minutes)
    AND (r.status_code IS NULL OR r.status_code < 200 OR r.status_code >= 300)
  ORDER BY r.created DESC
$$;

REVOKE ALL ON FUNCTION public.get_recent_scrape_failures(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_scrape_failures(int) TO service_role;