-- Reply lifecycle tracking on acquisition leads
ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS reply_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_sender_email text,
  ADD COLUMN IF NOT EXISTS reply_thread_message_id text,
  ADD COLUMN IF NOT EXISTS reply_intent text,
  ADD COLUMN IF NOT EXISTS portal_key_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS outbound_recipients text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_acquisition_leads_reply_sender
  ON public.acquisition_leads (lower(reply_sender_email));
CREATE INDEX IF NOT EXISTS idx_acquisition_leads_business_email_lower
  ON public.acquisition_leads (lower(business_email));
CREATE INDEX IF NOT EXISTS idx_acquisition_leads_outbound_recipients
  ON public.acquisition_leads USING gin (outbound_recipients);
CREATE INDEX IF NOT EXISTS idx_acquisition_leads_campaign_status
  ON public.acquisition_leads (campaign_status);

-- Idempotency + audit ledger for verified inbound Resend events
CREATE TABLE IF NOT EXISTS public.acquisition_inbound_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  from_email text,
  to_email text,
  subject text,
  provider_message_id text,
  lead_id uuid REFERENCES public.acquisition_leads(id) ON DELETE SET NULL,
  intent text,
  action text,
  error text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_acquisition_inbound_events_provider_event
  ON public.acquisition_inbound_events (provider_event_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_inbound_events_lead
  ON public.acquisition_inbound_events (lead_id, created_at DESC);

GRANT SELECT ON public.acquisition_inbound_events TO authenticated;
GRANT ALL ON public.acquisition_inbound_events TO service_role;

ALTER TABLE public.acquisition_inbound_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view inbound acquisition events" ON public.acquisition_inbound_events;
CREATE POLICY "Admins can view inbound acquisition events"
  ON public.acquisition_inbound_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Service role manages inbound acquisition events" ON public.acquisition_inbound_events;
CREATE POLICY "Service role manages inbound acquisition events"
  ON public.acquisition_inbound_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Atomic claim: only one verified webhook delivery may flip a lead to
-- replied_interested and win the right to send the portal key.
CREATE OR REPLACE FUNCTION public.claim_acquisition_reply(
  _lead_id uuid,
  _sender text,
  _thread_message_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed integer;
BEGIN
  UPDATE public.acquisition_leads
     SET campaign_status = 'replied_interested',
         reply_received_at = COALESCE(reply_received_at, timezone('utc', now())),
         reply_sender_email = _sender,
         reply_thread_message_id = _thread_message_id,
         reply_intent = 'positive',
         email_error = NULL
   WHERE id = _lead_id
     AND campaign_status NOT IN ('replied_interested', 'portal_activated', 'activated')
     AND portal_key_sent_at IS NULL;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_acquisition_reply(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_acquisition_reply(uuid, text, text) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.acquisition_leads;