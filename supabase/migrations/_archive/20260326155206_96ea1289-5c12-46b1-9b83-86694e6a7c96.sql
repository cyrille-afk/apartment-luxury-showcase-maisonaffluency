-- Create a public view excluding trade_price_cents
CREATE VIEW public.designer_curator_picks_public
WITH (security_invoker = on) AS
SELECT id, designer_id, image_url, hover_image_url, title, subtitle,
       category, subcategory, tags, materials, dimensions, description,
       edition, photo_credit, pdf_url, pdf_filename, pdf_urls, currency,
       sort_order, created_at
FROM public.designer_curator_picks;

-- Drop the anon policy that exposes pricing
DROP POLICY IF EXISTS "Anyone can view published designer picks" ON public.designer_curator_picks;

-- Re-create it for authenticated users only (not anon)
CREATE POLICY "Authenticated can view published designer picks"
  ON public.designer_curator_picks
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM designers
    WHERE designers.id = designer_curator_picks.designer_id
      AND designers.is_published = true
  ));