CREATE TABLE IF NOT EXISTS public.email_click_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL,
  link_id TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  recipient_email TEXT,
  user_agent TEXT,
  referer TEXT,
  ip_hash TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_click_log_template_link ON public.email_click_log(template_name, link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_click_log_clicked_at ON public.email_click_log(clicked_at DESC);

ALTER TABLE public.email_click_log ENABLE ROW LEVEL SECURITY;

-- Admins can view click logs
CREATE POLICY "Admins can view email click logs"
ON public.email_click_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
