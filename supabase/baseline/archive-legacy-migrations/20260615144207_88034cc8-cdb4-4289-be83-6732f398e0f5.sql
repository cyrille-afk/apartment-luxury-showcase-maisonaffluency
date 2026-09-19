
-- Restrict cad_documents writes to trade_user or admin roles to prevent any authenticated user from uploading orphan CAD files.

DROP POLICY IF EXISTS "Studio members can insert cad documents" ON public.cad_documents;
CREATE POLICY "Studio members can insert cad documents"
ON public.cad_documents
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    (studio_id IS NULL AND (public.has_role(auth.uid(), 'trade_user') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')))
    OR (studio_id IS NOT NULL AND public.can_view_studio(auth.uid(), studio_id))
  )
);

DROP POLICY IF EXISTS "Studio editors or uploader can update cad documents" ON public.cad_documents;
CREATE POLICY "Studio editors or uploader can update cad documents"
ON public.cad_documents
FOR UPDATE
TO authenticated
USING (
  (uploaded_by = auth.uid() AND (studio_id IS NOT NULL OR public.has_role(auth.uid(), 'trade_user') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')))
  OR (studio_id IS NOT NULL AND public.can_edit_studio(auth.uid(), studio_id))
)
WITH CHECK (
  (uploaded_by = auth.uid() AND (studio_id IS NOT NULL OR public.has_role(auth.uid(), 'trade_user') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')))
  OR (studio_id IS NOT NULL AND public.can_edit_studio(auth.uid(), studio_id))
);

DROP POLICY IF EXISTS "Studio editors or uploader can delete cad documents" ON public.cad_documents;
CREATE POLICY "Studio editors or uploader can delete cad documents"
ON public.cad_documents
FOR DELETE
TO authenticated
USING (
  (uploaded_by = auth.uid() AND (studio_id IS NOT NULL OR public.has_role(auth.uid(), 'trade_user') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')))
  OR (studio_id IS NOT NULL AND public.can_edit_studio(auth.uid(), studio_id))
);
