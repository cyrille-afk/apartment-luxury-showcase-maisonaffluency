-- 1. Drop the overly permissive public SELECT policy that exposes trade_price_cents
DROP POLICY IF EXISTS "Anyone can view curator picks" ON public.designer_curator_picks;

-- 2. Recreate the public view WITHOUT security_invoker so it bypasses RLS
-- This lets anon users read through the sanitized view (no trade_price_cents)
-- while the base table remains locked to trade_user/admin only
DROP VIEW IF EXISTS public.designer_curator_picks_public;
CREATE VIEW public.designer_curator_picks_public AS
SELECT id, designer_id, image_url, hover_image_url, title, subtitle,
       category, subcategory, tags, materials, dimensions, description,
       edition, photo_credit, pdf_url, pdf_filename, pdf_urls, currency,
       sort_order, created_at
FROM designer_curator_picks;

-- Grant anon and authenticated SELECT on the view
GRANT SELECT ON public.designer_curator_picks_public TO anon, authenticated;