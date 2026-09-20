-- ── Risk 1: GDPR data-subject rights (access / portability / erasure) ──────
CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('access','portability','erasure','rectification','restriction')),
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification','verified','in_progress','fulfilled','rejected','expired')),
  verification_token_hash TEXT,
  verified_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  export_storage_path TEXT,
  erased_tables JSONB,
  details TEXT,
  admin_notes TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dsar_email ON public.data_subject_requests (lower(email));
CREATE INDEX IF NOT EXISTS idx_dsar_status_due ON public.data_subject_requests (status, due_at);
CREATE INDEX IF NOT EXISTS idx_dsar_user_id ON public.data_subject_requests (user_id);

GRANT SELECT ON public.data_subject_requests TO authenticated;
GRANT ALL ON public.data_subject_requests TO service_role;

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read data subject requests" ON public.data_subject_requests;
CREATE POLICY "Admins read data subject requests"
ON public.data_subject_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users read own data subject requests" ON public.data_subject_requests;
CREATE POLICY "Users read own data subject requests"
ON public.data_subject_requests FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ── Risk 2: quarantine state for uploaded credential documents ─────────────
ALTER TABLE public.trade_credential_documents
  ADD COLUMN IF NOT EXISTS active_content_flags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quarantined BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scan_verdict JSONB;

CREATE INDEX IF NOT EXISTS idx_trade_credential_documents_quarantined
  ON public.trade_credential_documents (quarantined) WHERE quarantined;

-- ── Risk 3: authoritative registry evidence on trade applications ──────────
ALTER TABLE public.trade_applications
  ADD COLUMN IF NOT EXISTS registry_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registry_verification JSONB,
  ADD COLUMN IF NOT EXISTS registry_checked_at TIMESTAMPTZ;