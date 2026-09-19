CREATE TABLE public.concierge_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  surface TEXT NOT NULL CHECK (surface IN ('public','trade')),
  user_id UUID,
  session_id TEXT NOT NULL,
  name TEXT,
  city TEXT,
  country TEXT,
  first_message TEXT,
  intent TEXT,
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  qualified_score INTEGER NOT NULL DEFAULT 0,
  path TEXT,
  user_agent TEXT,
  referrer TEXT,
  notified_at TIMESTAMPTZ
);

CREATE INDEX concierge_leads_session_idx ON public.concierge_leads (session_id, created_at DESC);
CREATE INDEX concierge_leads_created_idx ON public.concierge_leads (created_at DESC);
CREATE INDEX concierge_leads_score_idx ON public.concierge_leads (qualified_score DESC);

GRANT INSERT ON public.concierge_leads TO anon, authenticated;
GRANT SELECT, UPDATE ON public.concierge_leads TO authenticated;
GRANT ALL ON public.concierge_leads TO service_role;

ALTER TABLE public.concierge_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert a concierge lead"
  ON public.concierge_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view all concierge leads"
  ON public.concierge_leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update concierge leads"
  ON public.concierge_leads FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER concierge_leads_set_updated_at
  BEFORE UPDATE ON public.concierge_leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();