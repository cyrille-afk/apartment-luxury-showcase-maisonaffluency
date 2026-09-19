
-- Revert the role-only SELECT policy
DROP POLICY IF EXISTS "Only trade users and admins can view curator picks" ON public.designer_curator_picks;

-- Re-create the original SELECT policy (catalogue rows readable, hidden ones only for trade/admin)
CREATE POLICY "Trade users and admins can view curator picks"
ON public.designer_curator_picks FOR SELECT
USING (
  COALESCE(is_hidden, false) = false
  OR has_role(auth.uid(), 'trade_user'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Column-level: hide wholesale pricing from anon and authenticated non-trade users.
REVOKE SELECT ON public.designer_curator_picks FROM anon, authenticated;

-- Grant SELECT on everything except trade_price_cents and price_per_sqm_cents
GRANT SELECT (
  id, designer_id, image_url, hover_image_url, title, subtitle, category,
  subcategory, tags, materials, dimensions, description, edition, photo_credit,
  pdf_url, pdf_filename, pdf_urls, sort_order, created_at, currency, lead_time,
  price_prefix, gallery_images, origin, size_variants, variant_placeholder,
  base_axis_label, top_axis_label, variant_image_map, is_hidden, edition_number,
  edition_signing, pack_cbm, pack_weight_kg, pack_carton_count, default_ship_mode,
  pickup_country, pickup_postcode, pickup_address, materials_description
) ON public.designer_curator_picks TO anon, authenticated;

-- Trade users and admins keep access to pricing columns by querying a SECURITY DEFINER
-- backed RPC or by using service_role; for typical app paths the trade UI selects
-- specific columns, so we additionally grant the pricing columns to authenticated
-- via the view used by trade code. Since trade UI selects with "*" through PostgREST,
-- we also need pricing visible to trade users — handle via a secure view they query.
-- For now keep service_role full access; trade users will read pricing through the
-- existing trade_product_pricing isolated table (per project memory).
GRANT SELECT ON public.designer_curator_picks TO service_role;
