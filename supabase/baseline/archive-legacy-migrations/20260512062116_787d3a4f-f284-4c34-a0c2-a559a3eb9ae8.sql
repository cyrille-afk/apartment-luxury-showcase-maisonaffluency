
CREATE TABLE public.quote_email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE,
  sent_by UUID NOT NULL,
  sent_by_email TEXT,
  recipient_email TEXT NOT NULL,
  client_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_email_log_quote_id ON public.quote_email_log(quote_id, created_at DESC);

ALTER TABLE public.quote_email_log ENABLE ROW LEVEL SECURITY;

-- Quote owner or admin can view
CREATE POLICY "View quote email log"
ON public.quote_email_log FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.trade_quotes q WHERE q.id = quote_id AND q.user_id = auth.uid())
);

-- Admins (or quote owner) can insert; sent_by must be the auth user
CREATE POLICY "Insert quote email log"
ON public.quote_email_log FOR INSERT
WITH CHECK (
  sent_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.trade_quotes q WHERE q.id = quote_id AND q.user_id = auth.uid())
  )
);
