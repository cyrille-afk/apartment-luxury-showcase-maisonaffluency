CREATE TABLE public.felix_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL,
  query text NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  user_id uuid,
  page_path text
);
GRANT SELECT ON public.felix_usage_events TO authenticated;
GRANT ALL ON public.felix_usage_events TO service_role;
ALTER TABLE public.felix_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read felix usage" ON public.felix_usage_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX felix_usage_events_created_idx ON public.felix_usage_events (created_at DESC);