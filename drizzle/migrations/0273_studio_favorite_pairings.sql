CREATE TABLE public.studio_favorite_pairings (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  reference_id uuid NOT NULL REFERENCES public.trade_products(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.trade_products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, reference_id, product_id),
  CONSTRAINT distinct_pairing_pieces CHECK (reference_id <> product_id)
);
GRANT SELECT, INSERT, DELETE ON public.studio_favorite_pairings TO authenticated;
GRANT ALL ON public.studio_favorite_pairings TO service_role;
ALTER TABLE public.studio_favorite_pairings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own favorite pairings" ON public.studio_favorite_pairings FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Save own readable pairings" ON public.studio_favorite_pairings FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.trade_products WHERE id = reference_id) AND EXISTS (SELECT 1 FROM public.trade_products WHERE id = product_id AND is_active = true AND is_hidden = false));
CREATE POLICY "Remove own favorite pairings" ON public.studio_favorite_pairings FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));