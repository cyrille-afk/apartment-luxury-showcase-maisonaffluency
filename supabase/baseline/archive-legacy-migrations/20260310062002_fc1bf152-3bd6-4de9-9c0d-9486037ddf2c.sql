
CREATE POLICY "Anyone can insert gallery hotspots"
  ON public.gallery_hotspots
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update gallery hotspots"
  ON public.gallery_hotspots
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete gallery hotspots"
  ON public.gallery_hotspots
  FOR DELETE
  TO anon, authenticated
  USING (true);
