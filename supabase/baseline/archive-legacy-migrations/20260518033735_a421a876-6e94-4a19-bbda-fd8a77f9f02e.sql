ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS edition_number text,
  ADD COLUMN IF NOT EXISTS edition_signing text;