ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text;

UPDATE public.acquisition_leads SET country = 'United Kingdom', city = 'London'
  WHERE source_index = 'London_Residential_Architects_2026';

UPDATE public.acquisition_leads SET country = 'Singapore', city = 'Singapore'
  WHERE source_index = 'Singapore_Residential_Architects_2026';

CREATE INDEX IF NOT EXISTS acquisition_leads_geo_idx
  ON public.acquisition_leads (country, city, campaign_status);