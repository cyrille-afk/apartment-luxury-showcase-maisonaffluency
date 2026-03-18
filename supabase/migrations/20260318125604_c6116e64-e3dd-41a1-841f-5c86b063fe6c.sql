-- Allow users to view their own unpublished gallery drafts
CREATE POLICY "Users can view own gallery drafts"
ON public.axonometric_gallery
FOR SELECT
TO authenticated
USING (created_by = auth.uid() AND is_published = false);

-- Allow users to update their own unpublished gallery items (for publishing)
CREATE POLICY "Users can update own gallery drafts"
ON public.axonometric_gallery
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() AND is_published = false)
WITH CHECK (created_by = auth.uid());

-- Allow users to delete their own unpublished gallery items
CREATE POLICY "Users can delete own gallery drafts"
ON public.axonometric_gallery
FOR DELETE
TO authenticated
USING (created_by = auth.uid() AND is_published = false);