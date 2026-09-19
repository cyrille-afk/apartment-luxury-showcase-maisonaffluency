
-- Per-product override for the wood-swatch picker label
ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS wood_label_override TEXT;

-- Seed Rodeo with the new "Base" wording
UPDATE public.designer_curator_picks
SET wood_label_override = 'Select the Wood Finish of the Base'
WHERE id = 'b1534548-cba8-4df4-b6fb-616f802b7bd2';

-- (B) Clear duplicate size_variants on Rodeo & Carmelina — their "base"
-- axis was just COM/Ecart fabric, which is now driven by product_fabrics.
-- Dimensions are already stored in the `dimensions` column on both rows.
UPDATE public.designer_curator_picks
SET size_variants = NULL,
    top_axis_label = NULL
WHERE id IN (
  'b1534548-cba8-4df4-b6fb-616f802b7bd2',
  '9baeef6c-d0fa-4789-ac9d-2703209486dd'
);
