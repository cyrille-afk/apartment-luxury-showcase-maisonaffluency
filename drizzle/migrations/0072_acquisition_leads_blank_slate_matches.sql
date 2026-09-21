UPDATE public.acquisition_leads
SET predicted_designer_matches = '{}'::text[]
WHERE predicted_designer_matches IS NULL;

ALTER TABLE public.acquisition_leads
  ALTER COLUMN predicted_designer_matches SET DEFAULT '{}'::text[];

ALTER TABLE public.acquisition_leads
  ALTER COLUMN predicted_designer_matches SET NOT NULL;