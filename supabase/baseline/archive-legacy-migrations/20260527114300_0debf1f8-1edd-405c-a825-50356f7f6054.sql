CREATE TABLE public.trade_concierge_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  project_id uuid,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  message_count integer,
  sentiment text,
  intent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tcu_user_created ON public.trade_concierge_usage(user_id, created_at DESC);
CREATE INDEX idx_tcu_created ON public.trade_concierge_usage(created_at DESC);

GRANT SELECT ON public.trade_concierge_usage TO authenticated;
GRANT ALL ON public.trade_concierge_usage TO service_role;

ALTER TABLE public.trade_concierge_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all concierge usage"
  ON public.trade_concierge_usage FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));