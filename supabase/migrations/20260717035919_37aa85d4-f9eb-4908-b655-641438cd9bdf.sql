
-- === collectible_overrides: restrict anon to slug column of trade_only=true rows ===
DROP POLICY IF EXISTS "Anyone can read collectible overrides" ON public.collectible_overrides;

CREATE POLICY "Authenticated can read collectible overrides"
  ON public.collectible_overrides
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can read only trade_only slugs"
  ON public.collectible_overrides
  FOR SELECT
  TO anon
  USING (trade_only = true);

REVOKE SELECT ON public.collectible_overrides FROM anon;
GRANT SELECT (slug, trade_only) ON public.collectible_overrides TO anon;

-- === descriptor_taxonomy: authenticated-only ===
DROP POLICY IF EXISTS "Public can read descriptor taxonomy" ON public.descriptor_taxonomy;

CREATE POLICY "Authenticated can read descriptor taxonomy"
  ON public.descriptor_taxonomy
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.descriptor_taxonomy FROM anon;

-- === material_taxonomy: keep anon read but limit to columns needed for public joins ===
REVOKE SELECT ON public.material_taxonomy FROM anon;
GRANT SELECT (id, family, is_active, slug, name) ON public.material_taxonomy TO anon;
