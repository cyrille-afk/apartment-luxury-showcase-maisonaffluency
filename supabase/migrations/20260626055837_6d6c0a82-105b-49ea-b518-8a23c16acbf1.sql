CREATE TABLE public.collectible_overrides (
  slug text PRIMARY KEY,
  trade_only boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.collectible_overrides TO anon, authenticated;
GRANT ALL ON public.collectible_overrides TO service_role;

ALTER TABLE public.collectible_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read collectible overrides"
  ON public.collectible_overrides
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage collectible overrides"
  ON public.collectible_overrides
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER collectible_overrides_set_updated_at
  BEFORE UPDATE ON public.collectible_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();