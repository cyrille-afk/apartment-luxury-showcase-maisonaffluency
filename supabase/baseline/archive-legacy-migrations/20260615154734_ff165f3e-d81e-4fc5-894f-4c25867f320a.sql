
-- Restrict SELECT on sensitive PII tables to editor+ studio members (not viewers)

DROP POLICY IF EXISTS "View boards (studio + project access)" ON public.client_boards;
CREATE POLICY "View boards (studio + project access)"
ON public.client_boards
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR ((project_id IS NOT NULL) AND can_edit_project(auth.uid(), project_id))
  OR ((project_id IS NULL) AND (studio_id IS NOT NULL) AND has_studio_role(auth.uid(), studio_id, 'editor'::studio_role))
  OR ((project_id IS NULL) AND (studio_id IS NULL) AND (user_id = auth.uid()))
);

DROP POLICY IF EXISTS "View timelines (studio + project access)" ON public.order_timeline;
CREATE POLICY "View timelines (studio + project access)"
ON public.order_timeline
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR ((project_id IS NOT NULL) AND can_edit_project(auth.uid(), project_id))
  OR ((project_id IS NULL) AND (studio_id IS NOT NULL) AND has_studio_role(auth.uid(), studio_id, 'editor'::studio_role))
  OR ((project_id IS NULL) AND (studio_id IS NULL) AND (user_id = auth.uid()))
);

DROP POLICY IF EXISTS "View quotes (studio + project access)" ON public.trade_quotes;
CREATE POLICY "View quotes (studio + project access)"
ON public.trade_quotes
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR ((project_id IS NOT NULL) AND can_edit_project(auth.uid(), project_id))
  OR ((project_id IS NULL) AND (studio_id IS NOT NULL) AND has_studio_role(auth.uid(), studio_id, 'editor'::studio_role))
  OR ((project_id IS NULL) AND (studio_id IS NULL) AND (user_id = auth.uid()))
);

-- Restrict payout account banking data SELECT to studio owners (and platform admins) only.
-- Studio 'admin' role members can still manage via the ALL policy but raw banking SELECT
-- is reserved for the studio owner.
DROP POLICY IF EXISTS "Studio owners and admins read payout accounts" ON public.studio_payout_accounts;
CREATE POLICY "Studio owners read payout accounts"
ON public.studio_payout_accounts
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_studio_role(auth.uid(), studio_id, 'owner'::studio_role)
);
