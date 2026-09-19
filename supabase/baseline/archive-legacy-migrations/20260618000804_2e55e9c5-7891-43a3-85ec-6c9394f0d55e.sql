-- Tighten studio_payout_accounts SELECT: only the creator, platform admins,
-- and studio admins can read raw banking details (IBAN/ACH/tax). Previously
-- every studio "owner" could read every other owner's full account.
DROP POLICY IF EXISTS "Studio owners read payout accounts" ON public.studio_payout_accounts;

CREATE POLICY "Payout accounts read (creator + admins)"
ON public.studio_payout_accounts
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
);