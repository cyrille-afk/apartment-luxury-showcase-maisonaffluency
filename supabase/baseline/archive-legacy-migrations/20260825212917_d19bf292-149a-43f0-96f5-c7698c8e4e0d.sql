CREATE TABLE public.ingestion_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  product_id uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingestion_queue_source_url_key UNIQUE (source_url),
  CONSTRAINT ingestion_queue_status_check CHECK (status IN ('pending','processing','completed','failed'))
);

CREATE INDEX ingestion_queue_status_idx ON public.ingestion_queue (status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingestion_queue TO authenticated;
GRANT ALL ON public.ingestion_queue TO service_role;

ALTER TABLE public.ingestion_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ingestion queue"
ON public.ingestion_queue FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER ingestion_queue_set_updated_at
BEFORE UPDATE ON public.ingestion_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ingestion_job_state (
  id boolean PRIMARY KEY DEFAULT true,
  lease_until timestamptz,
  lease_owner text,
  is_paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingestion_job_state_singleton CHECK (id)
);

GRANT SELECT, UPDATE ON public.ingestion_job_state TO authenticated;
GRANT ALL ON public.ingestion_job_state TO service_role;

ALTER TABLE public.ingestion_job_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ingestion job state"
ON public.ingestion_job_state FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER ingestion_job_state_set_updated_at
BEFORE UPDATE ON public.ingestion_job_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ingestion_job_state (id) VALUES (true) ON CONFLICT DO NOTHING;