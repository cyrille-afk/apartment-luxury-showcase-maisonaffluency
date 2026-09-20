ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS founder_title TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS discovery_node TEXT,
  ADD COLUMN IF NOT EXISTS tagged_designer TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_provider TEXT,
  ADD COLUMN IF NOT EXISTS aesthetic_score INTEGER,
  ADD COLUMN IF NOT EXISTS last_ingested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_acquisition_leads_discovery_node
  ON public.acquisition_leads (discovery_node);
CREATE INDEX IF NOT EXISTS idx_acquisition_leads_country_city
  ON public.acquisition_leads (country, city);