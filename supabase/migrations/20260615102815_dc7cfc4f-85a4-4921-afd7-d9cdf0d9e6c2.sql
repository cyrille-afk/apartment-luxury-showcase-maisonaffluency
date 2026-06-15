
-- Fix 1: fabrics — prevent anon from reading pricing columns.
-- Strategy: revoke table-wide SELECT from anon, regrant SELECT only on
-- non-sensitive columns. RLS still gates row visibility via the existing
-- "Active fabric swatches are publicly readable" policy.
REVOKE SELECT ON public.fabrics FROM anon;
GRANT SELECT (
  id, name, description, image_url, category, supplier,
  sort_order, is_active, created_at, updated_at
) ON public.fabrics TO anon;

-- Fix 2: storage cad-uploads — require uploader's UID as 2nd path segment
-- when writing into a studio-prefixed path, so a viewer-role member cannot
-- impersonate another member's folder.
DROP POLICY IF EXISTS "Studio members can upload cad-uploads" ON storage.objects;
CREATE POLICY "Studio members can upload cad-uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cad-uploads'
  AND (
    -- Personal folder: user's own UID
    (storage.foldername(name))[1] = (auth.uid())::text
    OR
    -- Studio folder: studio_id / uploader_uid / ...
    EXISTS (
      SELECT 1 FROM public.studios s
      WHERE (s.id)::text = (storage.foldername(name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
        AND (storage.foldername(name))[2] = (auth.uid())::text
    )
  )
);

DROP POLICY IF EXISTS "Studio members can delete cad-uploads" ON storage.objects;
CREATE POLICY "Studio members can delete cad-uploads"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR
    -- Only the uploader (matching 2nd segment) can delete within a studio path.
    EXISTS (
      SELECT 1 FROM public.studios s
      WHERE (s.id)::text = (storage.foldername(name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
        AND (storage.foldername(name))[2] = (auth.uid())::text
    )
  )
);
