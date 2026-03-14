DROP POLICY IF EXISTS "Trade users can view products" ON public.trade_products;

CREATE POLICY "Authenticated users can view products"
ON public.trade_products
FOR SELECT
TO authenticated
USING (true);