ALTER TABLE public.designers ADD COLUMN IF NOT EXISTS is_independent boolean NOT NULL DEFAULT false;

UPDATE public.designers SET is_independent = true WHERE slug = 'fabrice-ausset';