ALTER TABLE public.admin_alert_log ALTER COLUMN error DROP NOT NULL;
ALTER TABLE public.admin_alert_log ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent';
ALTER TABLE public.admin_alert_log ADD COLUMN IF NOT EXISTS provider_message_id text;
CREATE INDEX IF NOT EXISTS admin_alert_log_application_id_idx ON public.admin_alert_log (application_id, created_at DESC);
GRANT SELECT ON public.admin_alert_log TO authenticated;
GRANT ALL ON public.admin_alert_log TO service_role;
DROP POLICY IF EXISTS "Admins can view alert log" ON public.admin_alert_log;
CREATE POLICY "Admins can view alert log" ON public.admin_alert_log
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));