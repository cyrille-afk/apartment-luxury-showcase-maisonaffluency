-- A maker's Trade Only setting protects their profile; each product's own
-- trade_only setting controls whether that product is publicly visible.
ALTER TABLE public.designer_curator_picks
  ALTER COLUMN trade_only SET DEFAULT true;

DROP POLICY IF EXISTS "Public can view visible curator picks safe projection"
  ON public.designer_curator_picks_public;

CREATE POLICY "Public can view visible curator picks safe projection"
  ON public.designer_curator_picks_public
  FOR SELECT
  TO public
  USING (
    is_hidden IS NOT TRUE
    AND EXISTS (
      SELECT 1
      FROM public.designers d
      WHERE d.id = designer_curator_picks_public.designer_id
        AND d.is_published = true
    )
  );

-- Return only safe credit fields. A Trade Only maker is included only when at
-- least one of their individually published products exists in the safe,
-- price-stripped product projection. Biography and other profile fields stay
-- protected by the existing designers RLS policies.
CREATE OR REPLACE FUNCTION public.public_trade_only_designer_credit(_slug text)
RETURNS TABLE(id uuid, name text, slug text, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT d.id, d.name, d.slug, d.display_name
  FROM public.designers d
  WHERE d.slug = _slug
    AND d.is_published = true
    AND (
      d.trade_only = false
      OR EXISTS (
        SELECT 1
        FROM public.designer_curator_picks_public p
        WHERE p.designer_id = d.id
          AND p.is_hidden IS NOT TRUE
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.public_catalog_designer_credits()
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  display_name text,
  source text,
  founder text,
  era text,
  country text,
  is_published boolean,
  trade_only boolean,
  is_independent boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    d.id, d.name, d.slug, d.display_name, d.source, d.founder,
    d.era, d.country, d.is_published, d.trade_only, d.is_independent
  FROM public.designers d
  WHERE d.is_published = true
    AND (
      d.trade_only = false
      OR EXISTS (
        SELECT 1
        FROM public.designer_curator_picks_public p
        WHERE p.designer_id = d.id
          AND p.is_hidden IS NOT TRUE
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.public_trade_only_designer_credit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_trade_only_designer_credit(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.public_catalog_designer_credits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_catalog_designer_credits() TO anon, authenticated, service_role;