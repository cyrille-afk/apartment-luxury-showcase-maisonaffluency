CREATE TABLE public.acquisition_outreach_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.acquisition_leads(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('instagram','linkedin','email')),
  hook text CHECK (hook IN ('A','B')),
  agent_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.acquisition_outreach_events TO authenticated;
GRANT ALL ON public.acquisition_outreach_events TO service_role;
ALTER TABLE public.acquisition_outreach_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read outreach events" ON public.acquisition_outreach_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins log own outreach events" ON public.acquisition_outreach_events FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) AND agent_id = auth.uid());
CREATE INDEX ON public.acquisition_outreach_events (created_at DESC);
-- Backfill historical sends (agent unknown)
INSERT INTO public.acquisition_outreach_events (lead_id, channel, hook, agent_id, created_at)
SELECT id, CASE WHEN instagram_outreach_status='LinkedIn Message Sent' THEN 'linkedin' ELSE 'instagram' END,
  CASE instagram_outreach_status WHEN 'DM Sent - AI Procurement' THEN 'A' WHEN 'DM Sent - White-Label' THEN 'B' END,
  NULL, COALESCE(instagram_dm_sent_at, created_at)
FROM public.acquisition_leads WHERE instagram_outreach_status <> 'untouched';
INSERT INTO public.acquisition_outreach_events (lead_id, channel, agent_id, created_at)
SELECT id, 'email', NULL, email_sent_at FROM public.acquisition_leads WHERE email_sent_at IS NOT NULL;