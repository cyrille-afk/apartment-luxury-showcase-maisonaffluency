
DROP POLICY IF EXISTS "Public can view visible curator picks safe projection" ON public.designer_curator_picks_public;
CREATE POLICY "Public can view visible curator picks safe projection"
ON public.designer_curator_picks_public
FOR SELECT
USING (
  (is_hidden IS NOT TRUE)
  AND EXISTS (
    SELECT 1 FROM public.designers d
    WHERE d.id = designer_curator_picks_public.designer_id
      AND d.is_published = true
      AND d.trade_only = false
  )
);

DROP POLICY IF EXISTS "Trade users and admins can view curator picks" ON public.designer_curator_picks;
CREATE POLICY "Trade users and admins can view curator picks"
ON public.designer_curator_picks
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'trade_user'::app_role)
    AND is_hidden IS NOT TRUE
  )
);
