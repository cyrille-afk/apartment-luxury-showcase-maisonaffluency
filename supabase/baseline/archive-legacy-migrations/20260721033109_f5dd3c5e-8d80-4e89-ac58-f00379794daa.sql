
DROP POLICY IF EXISTS "Authenticated can read collectible overrides" ON public.collectible_overrides;
CREATE POLICY "Trade and admin can read collectible overrides"
ON public.collectible_overrides FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read descriptor taxonomy" ON public.descriptor_taxonomy;
CREATE POLICY "Trade and admin can read descriptor taxonomy"
ON public.descriptor_taxonomy FOR SELECT
TO authenticated
USING ((is_active = true AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role))) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public can read material taxonomy" ON public.material_taxonomy;
CREATE POLICY "Trade and admin can read material taxonomy"
ON public.material_taxonomy FOR SELECT
TO authenticated
USING (is_active = true AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));
