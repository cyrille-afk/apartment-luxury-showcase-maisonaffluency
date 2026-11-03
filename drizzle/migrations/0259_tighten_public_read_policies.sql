DROP POLICY IF EXISTS "website_status_public_read" ON public.website_status;
CREATE POLICY "website_status_public_read" ON public.website_status FOR SELECT TO anon, authenticated
USING (path IN ('/', '/designers', '/gallery', '/trade-program'));

DROP POLICY IF EXISTS "website_incidents_public_read" ON public.website_status_incidents;
CREATE POLICY "website_incidents_public_read" ON public.website_status_incidents FOR SELECT TO anon, authenticated
USING (path IN ('/', '/designers', '/gallery', '/trade-program'));

DROP POLICY IF EXISTS "Signed-in users read finish categories" ON public.finish_facet_overrides;
CREATE POLICY "Signed-in users read finish categories" ON public.finish_facet_overrides FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'trade_user') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);