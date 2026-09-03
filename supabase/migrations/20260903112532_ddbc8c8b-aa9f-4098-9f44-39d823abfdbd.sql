CREATE OR REPLACE FUNCTION public.is_approved_trade_user(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'super_admin'::app_role)
    OR (
      public.has_role(_user_id, 'trade_user'::app_role)
      AND (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.trade_status = 'approved')
        OR EXISTS (SELECT 1 FROM public.trade_applications ta WHERE ta.user_id = _user_id AND ta.status = 'approved'::trade_application_status)
      )
    )
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_approved_trade_user(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Trade users and admins can read trade pricing" ON public.trade_product_pricing;
CREATE POLICY "Approved trade users and admins can read trade pricing"
ON public.trade_product_pricing FOR SELECT TO authenticated
USING (public.is_approved_trade_user(auth.uid()));

DROP POLICY IF EXISTS "Trade users and admins can view products" ON public.trade_products;
CREATE POLICY "Approved trade users and admins can view products"
ON public.trade_products FOR SELECT TO authenticated
USING (public.is_approved_trade_user(auth.uid()));

DROP POLICY IF EXISTS "Trade users view tier config" ON public.trade_tier_config;
CREATE POLICY "Approved trade users view tier config"
ON public.trade_tier_config FOR SELECT TO authenticated
USING (public.is_approved_trade_user(auth.uid()));

DROP POLICY IF EXISTS "Trade users and admins can view curator picks" ON public.designer_curator_picks;
CREATE POLICY "Approved trade users and admins can view curator picks"
ON public.designer_curator_picks FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.is_approved_trade_user(auth.uid()) AND is_hidden IS NOT TRUE)
);

CREATE OR REPLACE FUNCTION public.protect_trade_application_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.tax_exempt_status := OLD.tax_exempt_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_trade_application_privileged_fields ON public.trade_applications;
CREATE TRIGGER trg_protect_trade_application_privileged_fields
BEFORE UPDATE ON public.trade_applications
FOR EACH ROW EXECUTE FUNCTION public.protect_trade_application_privileged_fields();