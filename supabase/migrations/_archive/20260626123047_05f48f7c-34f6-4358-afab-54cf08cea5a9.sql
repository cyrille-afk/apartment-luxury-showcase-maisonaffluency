
-- 1) studio_invites: revoke table-wide SELECT from authenticated; grant only non-secret columns.
REVOKE SELECT ON public.studio_invites FROM authenticated;
GRANT SELECT (id, studio_id, email, role, invited_by, accepted_at, expires_at, created_at)
  ON public.studio_invites TO authenticated;
-- service_role retains full access for invite-accept edge functions
GRANT ALL ON public.studio_invites TO service_role;

-- 2) order_timeline: tighten SELECT — drop blanket studio-editor visibility.
DROP POLICY IF EXISTS "View timelines (studio + project access)" ON public.order_timeline;
CREATE POLICY "View timelines (owner, project editor, or admin)"
ON public.order_timeline
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (user_id = auth.uid())
  OR (project_id IS NOT NULL AND can_edit_project(auth.uid(), project_id))
);

-- 3) trade_quotes: same tightening.
DROP POLICY IF EXISTS "View quotes (studio + project access)" ON public.trade_quotes;
CREATE POLICY "View quotes (owner, project editor, or admin)"
ON public.trade_quotes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (user_id = auth.uid())
  OR (project_id IS NOT NULL AND can_edit_project(auth.uid(), project_id))
);
