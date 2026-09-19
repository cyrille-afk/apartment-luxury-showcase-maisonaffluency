
ALTER TABLE public.product_fabrics
  ADD COLUMN IF NOT EXISTS price_tier_label text;

COMMENT ON COLUMN public.product_fabrics.price_tier_label IS
  'Optional label that matches a value of the Upholstery (top) axis in the linked pick''s size_variants. When set, selecting this swatch on the product page auto-selects that upholstery row in the variant price matrix.';
