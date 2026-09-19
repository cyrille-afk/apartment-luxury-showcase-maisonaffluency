DROP VIEW IF EXISTS public.designer_curator_picks_public;

CREATE VIEW public.designer_curator_picks_public
WITH (security_invoker = true) AS
SELECT category, created_at, currency, description, designer_id, dimensions,
       edition, hover_image_url, id, image_url, lead_time, origin, materials,
       pdf_filename, pdf_url, pdf_urls, photo_credit, sort_order, subcategory,
       subtitle, tags, title, gallery_images, size_variants, variant_placeholder,
       base_axis_label, top_axis_label, variant_image_map,
       edition_number, edition_signing
FROM public.designer_curator_picks
WHERE is_hidden = false;