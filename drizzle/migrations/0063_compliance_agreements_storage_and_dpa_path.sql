-- Signed DPA artefact metadata on the sub-processor register
ALTER TABLE public.sub_processor_registry
  ADD COLUMN IF NOT EXISTS signed_dpa_path TEXT,
  ADD COLUMN IF NOT EXISTS signed_dpa_filename TEXT,
  ADD COLUMN IF NOT EXISTS signed_dpa_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS signed_dpa_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS signed_dpa_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_dpa_uploaded_by UUID;

-- Compliance officer predicate: administrators only, no public/anon path.
CREATE OR REPLACE FUNCTION public.is_compliance_officer(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'super_admin'::app_role)
$$;

-- Storage RLS: private compliance bucket, admin-only read/write/list/delete.
DROP POLICY IF EXISTS "Compliance officers read DPA agreements" ON storage.objects;
CREATE POLICY "Compliance officers read DPA agreements"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'compliance-agreements' AND public.is_compliance_officer(auth.uid()));

DROP POLICY IF EXISTS "Compliance officers write DPA agreements" ON storage.objects;
CREATE POLICY "Compliance officers write DPA agreements"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'compliance-agreements' AND public.is_compliance_officer(auth.uid()));

DROP POLICY IF EXISTS "Compliance officers update DPA agreements" ON storage.objects;
CREATE POLICY "Compliance officers update DPA agreements"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'compliance-agreements' AND public.is_compliance_officer(auth.uid()))
WITH CHECK (bucket_id = 'compliance-agreements' AND public.is_compliance_officer(auth.uid()));

DROP POLICY IF EXISTS "Compliance officers delete DPA agreements" ON storage.objects;
CREATE POLICY "Compliance officers delete DPA agreements"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'compliance-agreements' AND public.is_compliance_officer(auth.uid()));