
-- Allow anonymous users to view active products (no auth required for public product pages)
-- Prices are NOT displayed on public pages (enforced in frontend)
CREATE POLICY "Anyone can view active products" ON public.trade_products
  FOR SELECT TO anon
  USING (is_active = true);
