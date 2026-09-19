
CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  user_id uuid NULL,
  status text NOT NULL DEFAULT 'ok',
  error_code text NULL,
  latency_ms integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai usage"
  ON public.ai_usage_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_ai_usage_events_created_at ON public.ai_usage_events (created_at DESC);
CREATE INDEX idx_ai_usage_events_feature_created ON public.ai_usage_events (feature, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_ai_usage_summary(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _daily jsonb;
  _by_feature jsonb;
  _totals jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO _daily
  FROM (
    SELECT
      date_trunc('day', created_at) AS day,
      feature,
      COUNT(*) AS requests,
      SUM(total_tokens) AS tokens,
      SUM(estimated_cost_usd) AS cost_usd
    FROM public.ai_usage_events
    WHERE created_at >= _from AND created_at < _to
    GROUP BY 1, 2
    ORDER BY 1, 2
  ) row;

  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO _by_feature
  FROM (
    SELECT
      feature,
      COUNT(*) AS requests,
      SUM(prompt_tokens) AS prompt_tokens,
      SUM(completion_tokens) AS completion_tokens,
      SUM(total_tokens) AS tokens,
      SUM(estimated_cost_usd) AS cost_usd,
      ROUND(AVG(total_tokens))::int AS avg_tokens,
      SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END) AS errors,
      MAX(created_at) AS last_call
    FROM public.ai_usage_events
    WHERE created_at >= _from AND created_at < _to
    GROUP BY feature
    ORDER BY cost_usd DESC NULLS LAST
  ) row;

  SELECT jsonb_build_object(
    'requests', COUNT(*),
    'tokens', COALESCE(SUM(total_tokens), 0),
    'cost_usd', COALESCE(SUM(estimated_cost_usd), 0),
    'errors', SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END)
  ) INTO _totals
  FROM public.ai_usage_events
  WHERE created_at >= _from AND created_at < _to;

  RETURN jsonb_build_object(
    'totals', _totals,
    'daily', _daily,
    'by_feature', _by_feature
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ai_usage_summary(timestamptz, timestamptz) TO authenticated;
