
-- ────────────────────────────────────────────────────────────────
-- 1) order_timeline: remove project-editor SELECT to protect ship-to PII.
--    Owners and admins keep full access. Editors still get UPDATE via
--    the existing "Update timelines (editor+ on project or studio)" policy.
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View timelines (owner, project editor, or admin)" ON public.order_timeline;

CREATE POLICY "View timelines (owner or admin)"
ON public.order_timeline
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR user_id = auth.uid()
  OR (studio_id IS NOT NULL AND has_studio_role(auth.uid(), studio_id, 'admin'::studio_role))
);

-- ────────────────────────────────────────────────────────────────
-- 2) studio_invites: re-issue column-level SELECT excluding `token`.
--    Token remains readable only by service_role.
-- ────────────────────────────────────────────────────────────────
REVOKE ALL ON public.studio_invites FROM anon, authenticated;
GRANT SELECT (id, studio_id, email, role, invited_by, created_at, expires_at, accepted_at, accepted_by)
  ON public.studio_invites TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.studio_invites TO authenticated;
GRANT ALL ON public.studio_invites TO service_role;

COMMENT ON COLUMN public.studio_invites.token IS
  'Invite secret. Service-role only. Never grant SELECT on this column to anon or authenticated.';

-- ────────────────────────────────────────────────────────────────
-- 3) client_board_comments: document that anonymous client posting is
--    not supported. Only board owners (authenticated) may insert.
-- ────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.client_board_comments IS
  'Comments on shared client boards. Only authenticated board owners can insert/select/update/delete. '
  'Anonymous/token-bearing clients cannot post comments by design — the is_client/author_name fields '
  'exist for owners to record comments attributed to a client during in-person review sessions.';
