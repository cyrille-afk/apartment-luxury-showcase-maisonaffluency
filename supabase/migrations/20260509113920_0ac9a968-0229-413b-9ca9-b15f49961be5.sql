-- Add is_hidden flag to suppress products from all gallery surfaces
ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_designer_curator_picks_is_hidden
  ON public.designer_curator_picks (is_hidden) WHERE is_hidden = false;

CREATE INDEX IF NOT EXISTS idx_trade_products_is_hidden
  ON public.trade_products (is_hidden) WHERE is_hidden = false;

-- Recreate the public view to exclude hidden picks at the source
CREATE OR REPLACE VIEW public.designer_curator_picks_public
WITH (security_invoker = on) AS
SELECT
  category,
  created_at,
  currency,
  description,
  designer_id,
  dimensions,
  edition,
  hover_image_url,
  id,
  image_url,
  lead_time,
  origin,
  materials,
  pdf_filename,
  pdf_url,
  pdf_urls,
  photo_credit,
  sort_order,
  subcategory,
  subtitle,
  tags,
  title,
  gallery_images,
  size_variants,
  variant_placeholder,
  base_axis_label,
  top_axis_label,
  variant_image_map
FROM public.designer_curator_picks
WHERE is_hidden = false;
