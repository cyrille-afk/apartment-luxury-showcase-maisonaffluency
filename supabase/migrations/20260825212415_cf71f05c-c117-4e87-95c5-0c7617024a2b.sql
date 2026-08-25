CREATE TABLE IF NOT EXISTS public.ai_model_pricing (
  model text PRIMARY KEY,
  input_usd_per_mtok numeric,
  output_usd_per_mtok numeric,
  flat_per_call_usd numeric,
  currency text NOT NULL DEFAULT 'USD',
  source text NOT NULL DEFAULT 'Lovable AI Gateway pricing',
  source_url text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_model_pricing TO authenticated;
GRANT ALL ON public.ai_model_pricing TO service_role;

ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ai model pricing" ON public.ai_model_pricing;
CREATE POLICY "Admins manage ai model pricing"
  ON public.ai_model_pricing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_ai_model_pricing_updated_at ON public.ai_model_pricing;
CREATE TRIGGER update_ai_model_pricing_updated_at
  BEFORE UPDATE ON public.ai_model_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_model_pricing (model, input_usd_per_mtok, output_usd_per_mtok, flat_per_call_usd, source, source_url, notes) VALUES
  ('google/gemini-3-flash-preview', 0.075, 0.3, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('google/gemini-3.5-flash', 0.1, 0.4, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('google/gemini-3.1-flash-lite', 0.05, 0.2, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('google/gemini-3.1-pro-preview', 1.25, 5, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('google/gemini-2.5-flash', 0.075, 0.3, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('google/gemini-2.5-flash-lite', 0.04, 0.15, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('google/gemini-2.5-pro', 1.25, 5, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('google/gemini-2.5-flash-image', NULL, NULL, 0.039, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', 'Flat per generated image'),
  ('google/gemini-3-flash-preview-image', NULL, NULL, 0.039, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', 'Flat per generated image'),
  ('google/gemini-3.1-flash-image', NULL, NULL, 0.039, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', 'Flat per generated image'),
  ('google/gemini-3-pro-image', NULL, NULL, 0.12, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', 'Flat per generated image'),
  ('openai/gpt-5', 1.25, 10, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('openai/gpt-5-mini', 0.25, 2, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('openai/gpt-5-nano', 0.05, 0.4, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('openai/gpt-5.2', 1.25, 10, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('openai/gpt-5.4', 2, 12, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('openai/gpt-5.4-mini', 0.4, 3, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('openai/gpt-5.4-nano', 0.1, 0.6, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('openai/gpt-5.4-pro', 5, 20, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('openai/gpt-5.5', 2.5, 15, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL),
  ('openai/gpt-5.5-pro', 6, 24, NULL, 'Lovable AI Gateway pricing', 'https://docs.lovable.dev/features/ai', NULL)
ON CONFLICT (model) DO UPDATE SET
  input_usd_per_mtok = EXCLUDED.input_usd_per_mtok,
  output_usd_per_mtok = EXCLUDED.output_usd_per_mtok,
  flat_per_call_usd = EXCLUDED.flat_per_call_usd,
  source = EXCLUDED.source,
  source_url = EXCLUDED.source_url,
  updated_at = now();

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
  _tier_feature_day jsonb;
  _pricing jsonb;
  _pricing_meta jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _ai_ev_tmp ON COMMIT DROP AS SELECT 1 WHERE false;

  WITH ev AS (
    SELECT
      e.*,
      CASE
        WHEN e.tier = 'strong' THEN 'Frontier'
        WHEN e.tier = 'balanced' THEN 'Flash'
        WHEN e.tier = 'cheap' THEN 'Classifier'
        WHEN e.tier = 'image' THEN 'Image'
        ELSE 'Untagged'
      END AS tier_label,
      CASE
        WHEN COALESCE(e.cached, false) THEN 0
        WHEN p.model IS NULL THEN COALESCE(e.estimated_cost_usd, 0)
        WHEN p.flat_per_call_usd IS NOT NULL THEN p.flat_per_call_usd
        ELSE (COALESCE(e.prompt_tokens, 0) * COALESCE(p.input_usd_per_mtok, 0)
            + COALESCE(e.completion_tokens, 0) * COALESCE(p.output_usd_per_mtok, 0)) / 1000000.0
      END AS cost_calc,
      (p.model IS NOT NULL) AS priced
    FROM public.ai_usage_events e
    LEFT JOIN public.ai_model_pricing p ON p.model = e.model
    WHERE e.created_at >= _from AND e.created_at < _to
  )
  SELECT
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
      SELECT date_trunc('day', created_at) AS day, feature, COUNT(*) AS requests,
             SUM(total_tokens) AS tokens, SUM(cost_calc) AS cost_usd
      FROM ev GROUP BY 1,2 ORDER BY 1,2) r),
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
      SELECT feature, COUNT(*) AS requests, SUM(prompt_tokens) AS prompt_tokens,
             SUM(completion_tokens) AS completion_tokens, SUM(total_tokens) AS tokens,
             SUM(cost_calc) AS cost_usd, ROUND(AVG(total_tokens))::int AS avg_tokens,
             SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END) AS errors,
             MAX(created_at) AS last_call
      FROM ev GROUP BY feature ORDER BY SUM(cost_calc) DESC NULLS LAST) r),
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
      SELECT tier_label AS tier, COUNT(*) AS requests, SUM(prompt_tokens) AS prompt_tokens,
             SUM(completion_tokens) AS completion_tokens, SUM(total_tokens) AS tokens,
             SUM(cost_calc) AS cost_usd, ROUND(AVG(total_tokens))::int AS avg_tokens,
             ROUND(AVG(latency_ms))::int AS avg_latency_ms,
             SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END) AS errors
      FROM ev GROUP BY 1 ORDER BY SUM(total_tokens) DESC NULLS LAST) r),
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
      SELECT date_trunc('day', created_at) AS day, tier_label AS tier, COUNT(*) AS requests,
             SUM(total_tokens) AS tokens, SUM(cost_calc) AS cost_usd
      FROM ev GROUP BY 1,2 ORDER BY 1,2) r),
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
      SELECT date_trunc('day', created_at) AS day, tier_label AS tier, feature,
             COUNT(*) AS requests,
             SUM(prompt_tokens) AS prompt_tokens,
             SUM(completion_tokens) AS completion_tokens,
             SUM(total_tokens) AS tokens,
             SUM(cost_calc) AS cost_usd,
             SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END) AS errors,
             SUM(CASE WHEN priced THEN 0 ELSE 1 END) AS unpriced_events,
             string_agg(DISTINCT model, ', ') AS models
      FROM ev GROUP BY 1,2,3 ORDER BY 1 DESC, 5 DESC) r),
    jsonb_build_object(
      'requests', COUNT(*),
      'tokens', COALESCE(SUM(total_tokens), 0),
      'cost_usd', COALESCE(SUM(cost_calc), 0),
      'errors', SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END)
    ),
    jsonb_build_object(
      'priced_events', COUNT(*) FILTER (WHERE priced),
      'unpriced_events', COUNT(*) FILTER (WHERE NOT priced),
      'unpriced_models', COALESCE((SELECT jsonb_agg(DISTINCT model) FROM ev WHERE NOT priced), '[]'::jsonb),
      'cached_events', COUNT(*) FILTER (WHERE COALESCE(cached, false))
    )
  INTO _daily, _by_feature, _by_tier, _daily_tier, _tier_feature_day, _totals, _pricing_meta
  FROM ev;

  SELECT COALESCE(jsonb_agg(r ORDER BY r.model), '[]'::jsonb) INTO _pricing
  FROM (
    SELECT model, input_usd_per_mtok, output_usd_per_mtok, flat_per_call_usd,
           currency, source, source_url, effective_from, updated_at
    FROM public.ai_model_pricing
  ) r;

  RETURN jsonb_build_object(
    'totals', _totals,
    'daily', _daily,
    'by_feature', _by_feature,
    'by_tier', _by_tier,
    'daily_tier', _daily_tier,
    'tier_feature_day', _tier_feature_day,
    'pricing', _pricing,
    'pricing_meta', _pricing_meta
  );
END;
$function$;