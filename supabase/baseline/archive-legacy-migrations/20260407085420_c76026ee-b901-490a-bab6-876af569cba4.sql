
-- Remove the overly permissive anon policy on the base table
DROP POLICY IF EXISTS "Anyone can view curator picks via public view" ON public.designer_curator_picks;

-- Recreate the view with security_invoker=false (intentional controlled bypass)
-- This is safe because the view explicitly excludes trade_price_cents
DROP VIEW IF EXISTS public.designer_curator_picks_public;

CREATE VIEW public.designer_curator_picks_public
WITH (security_invoker = false)
AS SELECT
  category, created_at, currency, description, designer_id, dimensions,
  edition, hover_image_url, id, image_url, lead_time, materials,
  pdf_filename, pdf_url, pdf_urls, photo_credit, sort_order,
  subcategory, subtitle, tags, title
FROM designer_curator_picks;

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.designer_curator_picks_public TO anon;
GRANT SELECT ON public.designer_curator_picks_public TO authenticated;
