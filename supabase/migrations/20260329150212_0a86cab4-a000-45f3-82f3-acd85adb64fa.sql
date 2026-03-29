-- Allow anyone (including unauthenticated users) to SELECT from designer_curator_picks
-- This is needed so the public designer profile pages can display curator picks
CREATE POLICY "Anyone can view curator picks"
ON public.designer_curator_picks
FOR SELECT
TO anon, authenticated
USING (true);
