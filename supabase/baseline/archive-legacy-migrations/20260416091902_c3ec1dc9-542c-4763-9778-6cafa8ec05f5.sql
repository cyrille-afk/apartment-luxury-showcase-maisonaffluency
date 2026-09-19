CREATE POLICY "Anyone can view curator picks"
ON public.designer_curator_picks
FOR SELECT
TO anon, authenticated
USING (true);