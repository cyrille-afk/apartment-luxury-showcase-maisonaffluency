-- 1. Project metadata
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS location_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS location_city         TEXT,
  ADD COLUMN IF NOT EXISTS trade_multiplier      NUMERIC NOT NULL DEFAULT 1.00;

-- 2. Reference table
CREATE TABLE IF NOT EXISTS public.regional_logistics_rules (
  id            SERIAL PRIMARY KEY,
  city          TEXT    NOT NULL,
  neighborhood  TEXT,
  multiplier    NUMERIC NOT NULL,
  shipping_tier TEXT    NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.regional_logistics_rules TO anon, authenticated;
GRANT ALL    ON public.regional_logistics_rules TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.regional_logistics_rules_id_seq TO authenticated, service_role;

ALTER TABLE public.regional_logistics_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regional_rules_public_read"  ON public.regional_logistics_rules;
DROP POLICY IF EXISTS "regional_rules_admin_write"  ON public.regional_logistics_rules;

CREATE POLICY "regional_rules_public_read"
  ON public.regional_logistics_rules
  FOR SELECT
  USING (true);

CREATE POLICY "regional_rules_admin_write"
  ON public.regional_logistics_rules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Unique key so ON CONFLICT works and seeds stay idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS regional_logistics_rules_city_hood_uk
  ON public.regional_logistics_rules (LOWER(city), LOWER(COALESCE(neighborhood, '')));

-- 3. Seed
INSERT INTO public.regional_logistics_rules (city, neighborhood, multiplier, shipping_tier)
VALUES ('New York', 'Brooklyn Heights', 0.85, 'White-Glove NY Hub')
ON CONFLICT DO NOTHING;

-- 4. Trigger function
CREATE OR REPLACE FUNCTION public.apply_regional_trade_multipliers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  found_multiplier NUMERIC;
BEGIN
  IF NEW.location_city IS NOT NULL AND NEW.location_neighborhood IS NOT NULL THEN
    SELECT multiplier INTO found_multiplier
    FROM public.regional_logistics_rules
    WHERE LOWER(city)         = LOWER(NEW.location_city)
      AND LOWER(neighborhood) = LOWER(NEW.location_neighborhood)
    LIMIT 1;
  END IF;

  IF found_multiplier IS NULL AND NEW.location_city IS NOT NULL THEN
    SELECT multiplier INTO found_multiplier
    FROM public.regional_logistics_rules
    WHERE LOWER(city) = LOWER(NEW.location_city)
      AND neighborhood IS NULL
    LIMIT 1;
  END IF;

  NEW.trade_multiplier := COALESCE(found_multiplier, 1.00);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_apply_regional_trade_multipliers ON public.projects;
CREATE TRIGGER tr_apply_regional_trade_multipliers
BEFORE INSERT OR UPDATE OF location_city, location_neighborhood
ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.apply_regional_trade_multipliers();