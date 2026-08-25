CREATE OR REPLACE FUNCTION public.admin_ai_usage_summary(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _daily jsonb;
  _by_feature jsonb;
  _totals jsonb;
  _by_tier jsonb;
  _daily_tier jsonb;
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

  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO _by_tier
  FROM (
    SELECT
      CASE
        WHEN tier = 'strong' THEN 'Frontier'
        WHEN tier = 'balanced' THEN 'Flash'
        WHEN tier = 'cheap' THEN 'Classifier'
        ELSE 'Untagged'
      END AS tier,
      COUNT(*) AS requests,
      SUM(prompt_tokens) AS prompt_tokens,
      SUM(completion_tokens) AS completion_tokens,
      SUM(total_tokens) AS tokens,
      SUM(estimated_cost_usd) AS cost_usd,
      ROUND(AVG(total_tokens))::int AS avg_tokens,
      ROUND(AVG(latency_ms))::int AS avg_latency_ms,
      SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END) AS errors
    FROM public.ai_usage_events
    WHERE created_at >= _from AND created_at < _to
    GROUP BY 1
    ORDER BY tokens DESC NULLS LAST
  ) row;

  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO _daily_tier
  FROM (
    SELECT
      date_trunc('day', created_at) AS day,
      CASE
        WHEN tier = 'strong' THEN 'Frontier'
        WHEN tier = 'balanced' THEN 'Flash'
        WHEN tier = 'cheap' THEN 'Classifier'
        ELSE 'Untagged'
      END AS tier,
      COUNT(*) AS requests,
      SUM(total_tokens) AS tokens,
      SUM(estimated_cost_usd) AS cost_usd
    FROM public.ai_usage_events
    WHERE created_at >= _from AND created_at < _to
    GROUP BY 1, 2
    ORDER BY 1, 2
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
    'by_feature', _by_feature,
    'by_tier', _by_tier,
    'daily_tier', _daily_tier
  );
END;
$function$;