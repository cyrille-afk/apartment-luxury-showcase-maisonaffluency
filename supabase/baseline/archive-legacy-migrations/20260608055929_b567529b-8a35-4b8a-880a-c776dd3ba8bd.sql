
-- Allow trade users to create their own gallery drafts
CREATE POLICY "Users can insert own gallery drafts"
  ON public.axonometric_gallery
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND is_published = false
    AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- Allow presentation owners to read comments on their own presentations
CREATE POLICY "Owners can read their presentation comments"
  ON public.presentation_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.presentations p
      WHERE p.id = presentation_comments.presentation_id
        AND p.created_by = auth.uid()
    )
  );

-- Allow presentation owners to read slides on their own presentations
CREATE POLICY "Owners can read their presentation slides"
  ON public.presentation_slides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.presentations p
      WHERE p.id = presentation_slides.presentation_id
        AND p.created_by = auth.uid()
    )
  );
