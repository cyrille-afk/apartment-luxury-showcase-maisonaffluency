CREATE TABLE IF NOT EXISTS public.acquisition_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_name text NOT NULL,
  founder_name text,
  business_email text UNIQUE NOT NULL,
  website_url text,
  source_index text DEFAULT 'AD100_Index',
  aesthetic_profile text,
  predicted_designer_matches text[],
  campaign_status text NOT NULL DEFAULT 'unprocessed',
  verified_at timestamptz,
  email_sent_at timestamptz,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acquisition_leads TO authenticated;
GRANT ALL ON public.acquisition_leads TO service_role;

ALTER TABLE public.acquisition_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage acquisition leads" ON public.acquisition_leads;
CREATE POLICY "Admins manage acquisition leads"
ON public.acquisition_leads
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS acquisition_leads_campaign_status_idx ON public.acquisition_leads (campaign_status);
CREATE INDEX IF NOT EXISTS acquisition_leads_created_at_idx ON public.acquisition_leads (created_at DESC);