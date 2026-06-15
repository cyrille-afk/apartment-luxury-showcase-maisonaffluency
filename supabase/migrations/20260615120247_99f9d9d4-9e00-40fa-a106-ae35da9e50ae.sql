-- Remove anonymous access to the fabrics table entirely.
-- Anonymous callers should only see non-pricing fields via the fabrics_public view.

DROP POLICY IF EXISTS "Active fabric swatches are publicly readable" ON public.fabrics;
REVOKE SELECT ON public.fabrics FROM anon;

-- Keep authenticated read (existing policies cover trade users + admins).
-- Create a sanitized public view that excludes price_per_lm_cents, tier, currency.
CREATE OR REPLACE VIEW public.fabrics_public
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  category,
  supplier,
  image_url,
  is_active,
  sort_order,
  created_at,
  updated_at
FROM public.fabrics
WHERE is_active = true;

GRANT SELECT ON public.fabrics_public TO anon, authenticated;

-- The view inherits RLS from the underlying table via security_invoker.
-- Re-add a narrow anon-readable policy on fabrics restricted to active rows
-- so the view returns rows for anon, but column GRANTs prevent direct pricing reads.
CREATE POLICY "fabrics public view access (active only)"
ON public.fabrics
FOR SELECT
TO anon
USING (is_active = true);

-- Lock columns: anon must never read pricing columns even via the table.
REVOKE ALL ON public.fabrics FROM anon;
GRANT SELECT (id, name, category, supplier, image_url, is_active, sort_order, created_at, updated_at)
  ON public.fabrics TO anon;
