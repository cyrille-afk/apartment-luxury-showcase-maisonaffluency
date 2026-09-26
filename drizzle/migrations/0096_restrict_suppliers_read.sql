DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON public.suppliers;
CREATE POLICY "Trade users can read suppliers" ON public.suppliers
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'trade_user'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));