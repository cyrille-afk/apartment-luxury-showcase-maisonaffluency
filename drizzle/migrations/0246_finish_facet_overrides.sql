CREATE TABLE public.finish_facet_overrides (
  finish_key text PRIMARY KEY,
  finish_name text NOT NULL,
  material text,
  finish text,
  color text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finish_facet_overrides TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.finish_facet_overrides TO authenticated;
GRANT ALL ON public.finish_facet_overrides TO service_role;
ALTER TABLE public.finish_facet_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read finish categories" ON public.finish_facet_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage finish categories" ON public.finish_facet_overrides FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));