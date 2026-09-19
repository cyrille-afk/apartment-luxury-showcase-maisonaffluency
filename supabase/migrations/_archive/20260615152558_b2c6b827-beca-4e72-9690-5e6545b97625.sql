
ALTER TABLE public.product_fabrics
  ADD COLUMN IF NOT EXISTS price_cents_a integer,
  ADD COLUMN IF NOT EXISTS price_cents_b integer;

ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS fabric_size_label_a text,
  ADD COLUMN IF NOT EXISTS fabric_size_label_b text;
