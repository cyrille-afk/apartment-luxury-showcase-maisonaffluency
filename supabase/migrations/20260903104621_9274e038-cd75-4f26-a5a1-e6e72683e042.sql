ALTER TYPE public.trade_application_status ADD VALUE IF NOT EXISTS 'flagged';

ALTER TABLE public.trade_applications
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS tax_vat_id text,
  ADD COLUMN IF NOT EXISTS credential_document_path text,
  ADD COLUMN IF NOT EXISTS tax_exempt_status boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_result jsonb,
  ADD COLUMN IF NOT EXISTS ai_verified_at timestamptz;

DROP POLICY IF EXISTS "Users upload own trade credentials" ON storage.objects;
CREATE POLICY "Users upload own trade credentials"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trade-credentials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users read own trade credentials" ON storage.objects;
CREATE POLICY "Users read own trade credentials"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'trade-credentials'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

DROP POLICY IF EXISTS "Admins manage trade credentials" ON storage.objects;
CREATE POLICY "Admins manage trade credentials"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'trade-credentials'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
)
WITH CHECK (
  bucket_id = 'trade-credentials'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);