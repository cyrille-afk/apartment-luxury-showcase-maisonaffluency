
ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS variant_image_map jsonb DEFAULT '{}'::jsonb;

CREATE OR REPLACE VIEW public.designer_curator_picks_public AS
SELECT category, created_at, currency, description, designer_id, dimensions,
       edition, hover_image_url, id, image_url, lead_time, origin, materials,
       pdf_filename, pdf_url, pdf_urls, photo_credit, sort_order, subcategory,
       subtitle, tags, title, gallery_images, size_variants, variant_placeholder,
       base_axis_label, top_axis_label, variant_image_map
FROM public.designer_curator_picks;

UPDATE public.designer_curator_picks
SET variant_image_map = '{"tarnishedsilverlacquered": 4, "tarnishedsilver": 4}'::jsonb
WHERE id = 'be988b38-e8f9-402d-a7f1-7d8ffad9fae2';
