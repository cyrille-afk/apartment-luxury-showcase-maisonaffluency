-- P2 #4: cad_documents UPDATE/DELETE — viewers can no longer edit studio-bound docs.
DROP POLICY IF EXISTS "Studio editors or uploader can update cad documents" ON public.cad_documents;
DROP POLICY IF EXISTS "Studio editors or uploader can delete cad documents" ON public.cad_documents;

CREATE POLICY "Studio editors can update cad documents"
ON public.cad_documents
FOR UPDATE
TO authenticated
USING (
  -- Studio-bound docs: only editors of that studio.
  ((studio_id IS NOT NULL) AND public.can_edit_studio(auth.uid(), studio_id))
  OR
  -- Legacy NULL-studio docs: uploader + trade role (back-compat for solo users).
  (
    (studio_id IS NULL)
    AND (uploaded_by = auth.uid())
    AND (
      public.has_role(auth.uid(), 'trade_user'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
)
WITH CHECK (
  ((studio_id IS NOT NULL) AND public.can_edit_studio(auth.uid(), studio_id))
  OR
  (
    (studio_id IS NULL)
    AND (uploaded_by = auth.uid())
    AND (
      public.has_role(auth.uid(), 'trade_user'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
);

CREATE POLICY "Studio editors can delete cad documents"
ON public.cad_documents
FOR DELETE
TO authenticated
USING (
  ((studio_id IS NOT NULL) AND public.can_edit_studio(auth.uid(), studio_id))
  OR
  (
    (studio_id IS NULL)
    AND (uploaded_by = auth.uid())
    AND (
      public.has_role(auth.uid(), 'trade_user'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
);

-- P2 #6: presentations + slides — drop the "every trade user sees every published one" policy.
DROP POLICY IF EXISTS "Trade users can view published presentations" ON public.presentations;
DROP POLICY IF EXISTS "Trade users can view published presentation slides" ON public.presentation_slides;