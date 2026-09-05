CREATE TABLE public.admin_alert_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL,
  event TEXT NOT NULL,
  application_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_alert_log TO service_role;
ALTER TABLE public.admin_alert_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_admin_alert_log_created_at ON public.admin_alert_log (created_at DESC);