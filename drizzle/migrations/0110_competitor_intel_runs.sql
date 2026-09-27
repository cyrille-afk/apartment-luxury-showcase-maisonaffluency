CREATE TABLE public.competitor_intel_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  lease_expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','paused')),
  pause_reason text,
  summary text,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.competitor_intel_runs TO authenticated;
GRANT ALL ON public.competitor_intel_runs TO service_role;
ALTER TABLE public.competitor_intel_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read intel runs" ON public.competitor_intel_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX competitor_intel_runs_started_idx ON public.competitor_intel_runs (started_at DESC);