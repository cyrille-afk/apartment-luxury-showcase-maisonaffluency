
-- 1) designer_curator_picks: do not expose hidden rows to the public
DROP POLICY IF EXISTS "Anyone can view curator picks" ON public.designer_curator_picks;
DROP POLICY IF EXISTS "Trade users can view all designer picks" ON public.designer_curator_picks;

CREATE POLICY "Public can view non-hidden curator picks"
ON public.designer_curator_picks
FOR SELECT
TO anon, authenticated
USING (
  COALESCE(is_hidden, false) = false
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'trade_user'::app_role)
);

-- 2) studio_lead_events: use the operational studios membership, not featured_studios
DROP POLICY IF EXISTS "Owners and admins can view studio lead events" ON public.studio_lead_events;

CREATE POLICY "Owners and admins can view studio lead events"
ON public.studio_lead_events
FOR SELECT
TO public
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    studio_id IS NOT NULL
    AND public.has_studio_role(auth.uid(), studio_id, 'owner'::public.studio_role)
  )
);
