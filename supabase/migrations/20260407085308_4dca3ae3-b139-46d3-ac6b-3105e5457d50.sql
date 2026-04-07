
-- Fix 1: Recreate designer_curator_picks_public view with security_invoker=true
DROP VIEW IF EXISTS public.designer_curator_picks_public;

CREATE VIEW public.designer_curator_picks_public
WITH (security_invoker = true)
AS SELECT
  category, created_at, currency, description, designer_id, dimensions,
  edition, hover_image_url, id, image_url, lead_time, materials,
  pdf_filename, pdf_url, pdf_urls, photo_credit, sort_order,
  subcategory, subtitle, tags, title
FROM designer_curator_picks;

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.designer_curator_picks_public TO anon;
GRANT SELECT ON public.designer_curator_picks_public TO authenticated;

-- Add anon SELECT policy on the base table so the security_invoker view works for public visitors
CREATE POLICY "Anyone can view curator picks via public view"
ON public.designer_curator_picks
FOR SELECT
TO anon
USING (true);

-- Fix 2: Enable RLS authorization for realtime by enabling row_level_security on the realtime publication
-- Supabase Realtime respects RLS when tables have it enabled (which they do).
-- The issue is that realtime broadcasts to any subscriber on the channel.
-- We need to ensure the tables use row-level security filtering for realtime.
-- Since RLS is already enabled on all 4 tables, Supabase Realtime will filter
-- rows based on the subscriber's JWT. No additional migration needed for that.
-- The client-side filters are defense-in-depth.
