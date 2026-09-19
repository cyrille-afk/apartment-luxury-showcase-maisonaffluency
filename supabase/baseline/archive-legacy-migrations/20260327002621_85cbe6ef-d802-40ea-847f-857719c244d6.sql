CREATE POLICY "Anon can view published designer picks"
ON public.designer_curator_picks
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM designers
    WHERE designers.id = designer_curator_picks.designer_id
    AND designers.is_published = true
  )
);