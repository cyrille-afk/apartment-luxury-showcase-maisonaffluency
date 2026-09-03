ALTER TABLE public.trade_applications
  ADD COLUMN IF NOT EXISTS verification_fingerprint text,
  ADD COLUMN IF NOT EXISTS approval_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_flag_alert_fingerprint text;

-- One learning-loop row per application per human decision.
DELETE FROM public.verification_feedback_loops a
USING public.verification_feedback_loops b
WHERE a.application_id = b.application_id
  AND a.admin_decision = b.admin_decision
  AND a.application_id IS NOT NULL
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS verification_feedback_loops_app_decision_key
  ON public.verification_feedback_loops (application_id, admin_decision)
  WHERE application_id IS NOT NULL;