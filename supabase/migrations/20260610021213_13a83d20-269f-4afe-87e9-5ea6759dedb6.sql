
-- Restore full column SELECT for authenticated (trade users) and service_role
GRANT SELECT ON public.designer_curator_picks TO authenticated;

-- Replace the SELECT policy: row visibility restricted to trade users / admins.
-- Public/anon callers must use designer_curator_picks_public (no pricing cols).
DROP POLICY IF EXISTS "Trade users and admins can view curator picks" ON public.designer_curator_picks;

CREATE POLICY "Trade users and admins can view curator picks"
ON public.designer_curator_picks FOR SELECT
USING (
  has_role(auth.uid(), 'trade_user'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Ensure the public view stays open
GRANT SELECT ON public.designer_curator_picks_public TO anon, authenticated;
