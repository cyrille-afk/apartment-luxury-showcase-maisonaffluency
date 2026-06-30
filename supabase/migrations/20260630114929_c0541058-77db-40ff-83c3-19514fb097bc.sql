
DROP POLICY IF EXISTS "Public can view visible curator picks safe projection" ON public.designer_curator_picks_public;

CREATE POLICY "Public can view visible curator picks safe projection"
ON public.designer_curator_picks_public
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.designers d
    WHERE d.id = designer_curator_picks_public.designer_id
      AND d.is_published = true
      AND d.trade_only = false
  )
);

CREATE INDEX IF NOT EXISTS idx_designer_curator_picks_public_designer_id
  ON public.designer_curator_picks_public(designer_id);
