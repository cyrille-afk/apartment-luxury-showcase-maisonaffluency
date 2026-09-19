CREATE TABLE public.og_rescrape_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  trigger_source text NOT NULL DEFAULT 'unknown',
  build_id text,
  manifest_size integer,
  current_snapshot_size integer,
  previous_snapshot_size integer,
  rescraped_count integer NOT NULL DEFAULT 0,
  forced boolean NOT NULL DEFAULT false,
  truncated boolean NOT NULL DEFAULT false,
  skipped boolean NOT NULL DEFAULT false,
  skipped_reason text,
  rescrape_result jsonb,
  error text
);

CREATE INDEX idx_og_rescrape_runs_created_at ON public.og_rescrape_runs (created_at DESC);

ALTER TABLE public.og_rescrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view OG rescrape runs"
ON public.og_rescrape_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));