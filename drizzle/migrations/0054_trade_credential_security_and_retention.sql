-- Anti-fraud + GDPR retention for trade credential documents.

-- Hash log of every credential ever submitted. Duplicate binaries across
-- different applicants are a strong fraud signal.
CREATE TABLE IF NOT EXISTS public.trade_credential_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256 text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  byte_size integer,
  email_domain text,
  ip_hash text,
  user_id uuid,
  application_id uuid,
  duplicate_of uuid REFERENCES public.trade_credential_documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Soft delete: set when the binary is purged from storage.
  deleted_at timestamptz,
  purge_after timestamptz
);

GRANT ALL ON public.trade_credential_documents TO service_role;
GRANT SELECT ON public.trade_credential_documents TO authenticated;

ALTER TABLE public.trade_credential_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read credential document log"
  ON public.trade_credential_documents FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS trade_credential_documents_sha_idx
  ON public.trade_credential_documents (sha256);
CREATE INDEX IF NOT EXISTS trade_credential_documents_ip_idx
  ON public.trade_credential_documents (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS trade_credential_documents_domain_idx
  ON public.trade_credential_documents (email_domain, created_at DESC);
CREATE INDEX IF NOT EXISTS trade_credential_documents_application_idx
  ON public.trade_credential_documents (application_id);
CREATE INDEX IF NOT EXISTS trade_credential_documents_purge_idx
  ON public.trade_credential_documents (purge_after)
  WHERE deleted_at IS NULL;

-- Application-level fraud + retention state.
ALTER TABLE public.trade_applications
  ADD COLUMN IF NOT EXISTS credential_sha256 text,
  ADD COLUMN IF NOT EXISTS credential_duplicate_of uuid,
  ADD COLUMN IF NOT EXISTS fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS credential_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS credential_purge_after timestamptz;

CREATE INDEX IF NOT EXISTS trade_applications_credential_purge_idx
  ON public.trade_applications (credential_purge_after)
  WHERE credential_deleted_at IS NULL;

-- Upload attempt log powering the IP / domain rate limit (kept separate from
-- the hash log so rejected attempts also count against the quota).
CREATE TABLE IF NOT EXISTS public.trade_upload_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text,
  email_domain text,
  accepted boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.trade_upload_attempts TO service_role;

ALTER TABLE public.trade_upload_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read upload attempts"
  ON public.trade_upload_attempts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS trade_upload_attempts_ip_idx
  ON public.trade_upload_attempts (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS trade_upload_attempts_domain_idx
  ON public.trade_upload_attempts (email_domain, created_at DESC);