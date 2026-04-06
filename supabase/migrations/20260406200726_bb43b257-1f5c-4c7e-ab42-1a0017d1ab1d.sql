
-- Recreate the public view with security_invoker = false so it bypasses RLS on the underlying table
-- This is safe because the view already strips trade_price_cents (the sensitive column)
DROP VIEW IF EXISTS public.designer_curator_picks_public;

CREATE VIEW public.designer_curator_picks_public
WITH (security_invoker = false)
AS
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
  materials,
  pdf_filename,
  pdf_url,
  pdf_urls,
  photo_credit,
  sort_order,
  subcategory,
  subtitle,
  tags,
  title
FROM designer_curator_picks;

-- Grant SELECT to anon and authenticated so both public visitors and logged-in users can read
GRANT SELECT ON public.designer_curator_picks_public TO anon;
GRANT SELECT ON public.designer_curator_picks_public TO authenticated;
