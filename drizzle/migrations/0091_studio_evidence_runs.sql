CREATE TABLE public.studio_evidence_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_account_id uuid NOT NULL,
  studio_name text,
  outcome text NOT NULL DEFAULT 'running',
  images_found int NOT NULL DEFAULT 0,
  images_cached int NOT NULL DEFAULT 0,
  images_reused int NOT NULL DEFAULT 0,
  skipped jsonb NOT NULL DEFAULT '[]'::jsonb,
  rate_limited_count int NOT NULL DEFAULT 0,
  reader_failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.studio_evidence_runs TO authenticated;
GRANT ALL ON public.studio_evidence_runs TO service_role;
ALTER TABLE public.studio_evidence_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read evidence runs" ON public.studio_evidence_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX studio_evidence_runs_started_idx ON public.studio_evidence_runs (started_at DESC);