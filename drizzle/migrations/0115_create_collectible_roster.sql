CREATE TABLE public.collectible_roster (
  roster_key text PRIMARY KEY,
  sort_order integer NOT NULL DEFAULT 0,
  gated boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collectible_roster TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.collectible_roster TO authenticated;
GRANT ALL ON public.collectible_roster TO service_role;
ALTER TABLE public.collectible_roster ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Collectible roster is publicly readable" ON public.collectible_roster FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage collectible roster" ON public.collectible_roster FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));