DROP POLICY IF EXISTS "Payout accounts read (creator + admins)" ON public.studio_payout_accounts;
CREATE POLICY "Payout accounts read (admins only)"
ON public.studio_payout_accounts
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
);