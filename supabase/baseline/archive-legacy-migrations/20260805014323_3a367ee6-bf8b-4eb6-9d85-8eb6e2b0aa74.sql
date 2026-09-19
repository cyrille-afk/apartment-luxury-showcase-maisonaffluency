-- 1) Rate-limit infrastructure for public analytics inserts
CREATE TABLE IF NOT EXISTS public.analytics_rate_limits (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  hits integer NOT NULL DEFAULT 0
);

GRANT ALL ON public.analytics_rate_limits TO service_role;
ALTER TABLE public.analytics_rate_limits ENABLE ROW LEVEL SECURITY;
-- no policies: table is only reachable through the SECURITY DEFINER trigger below

CREATE OR REPLACE FUNCTION public.enforce_analytics_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j jsonb := to_jsonb(NEW);
  actor text;
  limit_per_min integer := COALESCE(NULLIF(TG_ARGV[0], '')::integer, 120);
  key text;
  current_hits integer;
BEGIN
  actor := COALESCE(
    auth.uid()::text,
    NULLIF(j->>'session_id', ''),
    NULLIF(j->>'visitor_hash', ''),
    NULLIF(j->>'ip_hash', ''),
    'global'
  );

  IF actor = 'global' THEN
    limit_per_min := limit_per_min * 20;
  END IF;

  key := TG_TABLE_NAME || ':' || actor;

  INSERT INTO public.analytics_rate_limits (bucket_key, window_start, hits)
  VALUES (key, date_trunc('minute', now()), 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET hits = CASE
                 WHEN public.analytics_rate_limits.window_start < date_trunc('minute', now())
                 THEN 1
                 ELSE public.analytics_rate_limits.hits + 1
               END,
        window_start = CASE
                 WHEN public.analytics_rate_limits.window_start < date_trunc('minute', now())
                 THEN date_trunc('minute', now())
                 ELSE public.analytics_rate_limits.window_start
               END
  RETURNING hits INTO current_hits;

  IF current_hits > limit_per_min THEN
    RAISE EXCEPTION 'Rate limit exceeded for % events', TG_TABLE_NAME
      USING ERRCODE = '53400';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_analytics_rate_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS rate_limit_video_watch_events ON public.video_watch_events;
CREATE TRIGGER rate_limit_video_watch_events BEFORE INSERT ON public.video_watch_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');

DROP TRIGGER IF EXISTS rate_limit_tour_events ON public.tour_events;
CREATE TRIGGER rate_limit_tour_events BEFORE INSERT ON public.tour_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');

DROP TRIGGER IF EXISTS rate_limit_magazine_badge_events ON public.magazine_badge_events;
CREATE TRIGGER rate_limit_magazine_badge_events BEFORE INSERT ON public.magazine_badge_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');

DROP TRIGGER IF EXISTS rate_limit_studio_lead_events ON public.studio_lead_events;
CREATE TRIGGER rate_limit_studio_lead_events BEFORE INSERT ON public.studio_lead_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');

DROP TRIGGER IF EXISTS rate_limit_concierge_leads ON public.concierge_leads;
CREATE TRIGGER rate_limit_concierge_leads BEFORE INSERT ON public.concierge_leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('20');

DROP TRIGGER IF EXISTS rate_limit_mcp_click_log ON public.mcp_click_log;
CREATE TRIGGER rate_limit_mcp_click_log BEFORE INSERT ON public.mcp_click_log
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');

DROP TRIGGER IF EXISTS rate_limit_mcp_query_log ON public.mcp_query_log;
CREATE TRIGGER rate_limit_mcp_query_log BEFORE INSERT ON public.mcp_query_log
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');

-- 2) Replace unconditional WITH CHECK(true) on the MCP logs with shape validation
DROP POLICY IF EXISTS "Anyone may insert MCP click events" ON public.mcp_click_log;
CREATE POLICY "Anyone may insert MCP click events"
  ON public.mcp_click_log FOR INSERT TO anon, authenticated
  WITH CHECK (
    click_type = ANY (ARRAY['product','signup','designer'])
    AND (designer_slug IS NULL OR char_length(designer_slug) <= 200)
    AND (ip_hash IS NULL OR char_length(ip_hash) <= 128)
    AND (user_agent IS NULL OR char_length(user_agent) <= 500)
    AND (referer IS NULL OR char_length(referer) <= 500)
  );

DROP POLICY IF EXISTS "Anyone may insert MCP query events" ON public.mcp_query_log;
CREATE POLICY "Anyone may insert MCP query events"
  ON public.mcp_query_log FOR INSERT TO anon, authenticated
  WITH CHECK (
    tool_name IS NOT NULL
    AND char_length(tool_name) BETWEEN 1 AND 200
    AND (args IS NULL OR pg_column_size(args) <= 8192)
    AND (result_count IS NULL OR (result_count >= 0 AND result_count <= 100000))
    AND (duration_ms IS NULL OR (duration_ms >= 0 AND duration_ms <= 600000))
  );

-- 3) Restrict object listing on the public image buckets to admins.
--    Public URLs keep working (buckets remain public); only metadata
--    enumeration of every stored file path is locked down.
DROP POLICY IF EXISTS "Authenticated can list public image buckets" ON storage.objects;
CREATE POLICY "Admins can list public image buckets"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = ANY (ARRAY['assets','avatars','designer-images'])
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );