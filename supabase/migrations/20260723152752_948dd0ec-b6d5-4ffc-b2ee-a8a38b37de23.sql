
-- 1) Allow invitees to insert themselves into studio_members via valid invite
CREATE POLICY "Invitees can join studios via valid invite"
ON public.studio_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.studio_invites si
    WHERE si.studio_id = studio_members.studio_id
      AND si.role = studio_members.role
      AND si.accepted_at IS NULL
      AND si.expires_at > now()
      AND lower(si.email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  )
);

-- 2) Tighten INSERT on trade_concierge_actions to require trade_user/admin
DROP POLICY IF EXISTS "Users insert their own concierge actions" ON public.trade_concierge_actions;
CREATE POLICY "Users insert their own concierge actions"
ON public.trade_concierge_actions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'trade_user'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);
