CREATE TABLE public.guardrail_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  feature text NOT NULL DEFAULT 'curatorial-query',
  model text,
  tier text,
  query text,
  invalid_names text[] NOT NULL DEFAULT '{}',
  valid_names text[] NOT NULL DEFAULT '{}',
  action text NOT NULL DEFAULT 'stripped',
  raw_answer text,
  final_answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guardrail_logs TO authenticated;
GRANT ALL ON public.guardrail_logs TO service_role;

ALTER TABLE public.guardrail_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view guardrail logs"
ON public.guardrail_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX guardrail_logs_created_at_idx ON public.guardrail_logs (created_at DESC);