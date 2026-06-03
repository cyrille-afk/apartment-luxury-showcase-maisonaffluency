-- Defence-in-depth: anon must never be able to read trade pricing from designer_curator_picks.
-- The public-facing app already reads from the view `designer_curator_picks_public`
-- (security_invoker=on, excludes pricing). We tighten the base table grants so a direct
-- anon PostgREST query like `?select=trade_price_cents` is denied at the privilege layer.

-- 1. Drop anon's blanket access (this also revokes UPDATE/DELETE/INSERT that RLS already blocked).
REVOKE ALL ON public.designer_curator_picks FROM anon;

-- 2. Re-grant SELECT only on the non-pricing columns. The view's security_invoker=on means
-- anon needs SELECT on these underlying columns to read through the view.
GRANT SELECT (
  id, designer_id, image_url, hover_image_url, title, subtitle,
  category, subcategory, tags, materials, dimensions, description,
  edition, photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order,
  created_at, currency, lead_time, price_prefix, gallery_images, origin,
  size_variants, variant_placeholder, base_axis_label, top_axis_label,
  variant_image_map, is_hidden, edition_number, edition_signing,
  pack_cbm, pack_weight_kg, pack_carton_count, default_ship_mode,
  pickup_country, pickup_postcode, pickup_address,
  embedding_source_hash, embedded_at, materials_description
) ON public.designer_curator_picks TO anon;

-- 3. Keep authenticated/service_role full table access (trade users + edge functions
-- legitimately read pricing). Re-assert in case migration history drifted.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.designer_curator_picks TO authenticated;
GRANT ALL ON public.designer_curator_picks TO service_role;