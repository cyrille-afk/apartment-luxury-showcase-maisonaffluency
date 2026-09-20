CREATE TABLE public.consent_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_hash text NOT NULL,
  policy_version text NOT NULL,
  method text NOT NULL,
  scope_necessary boolean NOT NULL DEFAULT true,
  scope_functional boolean NOT NULL DEFAULT false,
  scope_analytics boolean NOT NULL DEFAULT false,
  scope_marketing boolean NOT NULL DEFAULT false,
  surface text,
  path text,
  user_agent_hash text,
  ip_hash text,
  decided_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_audit_subject ON public.consent_audit_log (subject_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_audit_created ON public.consent_audit_log (created_at DESC);

GRANT SELECT, INSERT ON public.consent_audit_log TO authenticated;
GRANT ALL ON public.consent_audit_log TO service_role;

ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read consent audit log"
ON public.consent_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.consent_audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'consent_audit_log is append-only and immutable';
END;
$$;

CREATE TRIGGER consent_audit_log_no_update
BEFORE UPDATE OR DELETE ON public.consent_audit_log
FOR EACH ROW EXECUTE FUNCTION public.consent_audit_log_immutable();