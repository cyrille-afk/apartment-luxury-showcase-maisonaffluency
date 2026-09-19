CREATE TABLE public.verification_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.trade_applications(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'ai',
  actor_user_id UUID,
  previous_status TEXT,
  confidence_score INTEGER,
  reasoning TEXT,
  attempt INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.verification_audit_log TO authenticated;
GRANT ALL ON public.verification_audit_log TO service_role;
ALTER TABLE public.verification_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read verification audit log" ON public.verification_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX idx_verification_audit_log_application ON public.verification_audit_log (application_id, created_at);