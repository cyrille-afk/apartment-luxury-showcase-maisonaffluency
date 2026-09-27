ALTER TABLE public.acquisition_leads DROP CONSTRAINT IF EXISTS acquisition_leads_instagram_outreach_status_check;
ALTER TABLE public.acquisition_leads ADD CONSTRAINT acquisition_leads_instagram_outreach_status_check
  CHECK (instagram_outreach_status = ANY (ARRAY['untouched'::text, 'dm_sent'::text, 'DM Sent - AI Procurement'::text, 'DM Sent - White-Label'::text]));