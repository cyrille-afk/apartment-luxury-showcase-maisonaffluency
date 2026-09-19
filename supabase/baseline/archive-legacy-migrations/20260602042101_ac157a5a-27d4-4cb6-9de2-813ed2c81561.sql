
GRANT SELECT ON public.designer_curator_picks TO anon;

DROP VIEW IF EXISTS public.designer_curator_picks_public;

CREATE VIEW public.designer_curator_picks_public
WITH (security_invoker = on) AS
SELECT
  id, designer_id, image_url, hover_image_url, title, subtitle,
  category, subcategory, tags, materials, dimensions, description,
  edition, photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order,
  created_at, currency, lead_time, price_prefix, gallery_images, origin,
  size_variants, variant_placeholder, base_axis_label, top_axis_label,
  variant_image_map, is_hidden, edition_number, edition_signing,
  pack_cbm, pack_weight_kg, pack_carton_count, default_ship_mode,
  pickup_country, pickup_postcode, pickup_address, materials_description
FROM public.designer_curator_picks;

GRANT SELECT ON public.designer_curator_picks_public TO anon, authenticated;
