-- studio_members: restrict role escalation to 'owner' and self-role changes
DROP POLICY IF EXISTS "Owners/admins can update member roles" ON public.studio_members;

CREATE POLICY "Owners/admins can update member roles"
ON public.studio_members
FOR UPDATE
USING (
  public.has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
)
WITH CHECK (
  public.has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
  -- Only existing owners can set another member's role to 'owner'
  AND (
    role <> 'owner'::studio_role
    OR public.has_studio_role(auth.uid(), studio_id, 'owner'::studio_role)
  )
  -- Prevent users from modifying their own role (no self-promotion)
  AND user_id <> auth.uid()
);

-- studio_invites: restrict issuing 'owner' invites to existing owners only
DROP POLICY IF EXISTS "Owners/admins can create invites" ON public.studio_invites;

CREATE POLICY "Owners/admins can create invites"
ON public.studio_invites
FOR INSERT
WITH CHECK (
  public.has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
  AND invited_by = auth.uid()
  AND (
    role <> 'owner'::studio_role
    OR public.has_studio_role(auth.uid(), studio_id, 'owner'::studio_role)
  )
);