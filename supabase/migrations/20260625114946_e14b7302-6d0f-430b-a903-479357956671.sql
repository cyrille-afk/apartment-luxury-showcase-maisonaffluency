ALTER TABLE public.designers ADD COLUMN IF NOT EXISTS collab_brands text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.designers
SET slug = 'alex-proba',
    founder = NULL,
    collab_brands = ARRAY['CC-Tapis']::text[]
WHERE slug = 'alex-proba-cc-tapis';