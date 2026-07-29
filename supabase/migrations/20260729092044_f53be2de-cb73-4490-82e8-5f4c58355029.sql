-- 1. Restrict regional_logistics_rules public read
DROP POLICY IF EXISTS regional_rules_public_read ON public.regional_logistics_rules;
REVOKE SELECT ON public.regional_logistics_rules FROM anon;
GRANT SELECT ON public.regional_logistics_rules TO authenticated;
CREATE POLICY regional_rules_trade_admin_read
  ON public.regional_logistics_rules
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'trade_user'::app_role)
  );

-- 2. Pin search_path on helper functions
ALTER FUNCTION public.slugify_text(text) SET search_path = public;
ALTER FUNCTION public.compute_curator_pick_slug(text, text) SET search_path = public;
ALTER FUNCTION public.set_curator_pick_slug() SET search_path = public;