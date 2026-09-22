ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS instagram_outreach_status text NOT NULL DEFAULT 'untouched',
  ADD COLUMN IF NOT EXISTS instagram_dm_sent_at timestamptz;

ALTER TABLE public.acquisition_leads
  ADD CONSTRAINT acquisition_leads_instagram_outreach_status_check
  CHECK (instagram_outreach_status IN ('untouched', 'dm_sent'));

CREATE INDEX IF NOT EXISTS idx_acquisition_leads_instagram_outreach_status
  ON public.acquisition_leads (instagram_outreach_status)
  WHERE instagram_outreach_status = 'dm_sent';