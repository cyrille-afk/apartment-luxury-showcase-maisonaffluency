-- Product favorites / saved items for trade professionals
CREATE TABLE public.trade_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.trade_products(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE public.trade_favorites ENABLE ROW LEVEL SECURITY;

-- Users can manage their own favorites
CREATE POLICY "Users can manage own favorites"
  ON public.trade_favorites FOR ALL
  TO authenticated
  USING (user_id = auth.uid() AND (has_role(auth.uid(), 'trade_user') OR has_role(auth.uid(), 'admin')))
  WITH CHECK (user_id = auth.uid() AND (has_role(auth.uid(), 'trade_user') OR has_role(auth.uid(), 'admin')));

-- Admins can view all favorites (for analytics)
CREATE POLICY "Admins can view all favorites"
  ON public.trade_favorites FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
