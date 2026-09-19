
DO $$ BEGIN
  CREATE TYPE public.region_tier AS ENUM ('ASEAN','GCC','ROW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.map_country_to_region_tier(_country text)
RETURNS public.region_tier
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(_country,''))) IN (
      'singapore','sg','malaysia','my','indonesia','id','thailand','th','vietnam','viet nam','vn',
      'philippines','ph','brunei','bn','cambodia','kh','laos','lao pdr','la','myanmar','burma','mm'
    ) THEN 'ASEAN'::public.region_tier
    WHEN lower(trim(coalesce(_country,''))) IN (
      'united arab emirates','uae','u.a.e.','ae','saudi arabia','ksa','sa','kingdom of saudi arabia',
      'qatar','qa','kuwait','kw','bahrain','bh','oman','om'
    ) THEN 'GCC'::public.region_tier
    ELSE 'ROW'::public.region_tier
  END
$$;

ALTER TABLE public.trade_applications
  ADD COLUMN IF NOT EXISTS region_tier public.region_tier NOT NULL DEFAULT 'ROW';

CREATE OR REPLACE FUNCTION public.set_region_tier_from_country()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.region_tier := public.map_country_to_region_tier(NEW.country);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_region_tier ON public.trade_applications;
CREATE TRIGGER trg_set_region_tier
BEFORE INSERT OR UPDATE OF country ON public.trade_applications
FOR EACH ROW EXECUTE FUNCTION public.set_region_tier_from_country();

UPDATE public.trade_applications
SET region_tier = public.map_country_to_region_tier(country)
WHERE region_tier IS DISTINCT FROM public.map_country_to_region_tier(country);

CREATE TABLE IF NOT EXISTS public.regional_logistics_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_tier public.region_tier NOT NULL UNIQUE,
  base_shipping_markup numeric NOT NULL DEFAULT 0,
  tax_handling_mode text NOT NULL DEFAULT 'standard',
  estimated_lead_time text NOT NULL DEFAULT '12-16 weeks',
  hub_city text,
  delivery_mode text NOT NULL DEFAULT 'sea_freight',
  show_singapore_tax boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.regional_logistics_tiers TO authenticated;
GRANT ALL ON public.regional_logistics_tiers TO service_role;
ALTER TABLE public.regional_logistics_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regional_tiers_read ON public.regional_logistics_tiers;
CREATE POLICY regional_tiers_read ON public.regional_logistics_tiers
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS regional_tiers_admin_write ON public.regional_logistics_tiers;
CREATE POLICY regional_tiers_admin_write ON public.regional_logistics_tiers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER update_regional_logistics_tiers_updated_at
BEFORE UPDATE ON public.regional_logistics_tiers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.regional_logistics_tiers
  (region_tier, base_shipping_markup, tax_handling_mode, estimated_lead_time, hub_city, delivery_mode, show_singapore_tax, notes)
VALUES
  ('ASEAN', 0.00, 'gst_inclusive', '10-14 weeks', 'Singapore District 9', 'local_white_glove', true,
   'Consolidated at our Singapore District 9 hub; local concierge white-glove delivery and installation.'),
  ('GCC', 0.18, 'tax_exempt_export', '6-9 weeks', 'Singapore District 9', 'air_freight', false,
   'Air-freight forwarding with bonded export documentation; local Singapore tax configurations hidden.'),
  ('ROW', 0.12, 'duties_on_arrival', '12-18 weeks', 'Singapore District 9', 'sea_freight', false,
   'Sea freight consolidation; duties and taxes settled on arrival.')
ON CONFLICT (region_tier) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.curated_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  featured_products uuid[] NOT NULL DEFAULT '{}',
  target_region text NOT NULL DEFAULT 'GLOBAL' CHECK (target_region IN ('ASEAN','GCC','ROW','GLOBAL')),
  hero_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.curated_drops TO authenticated;
GRANT ALL ON public.curated_drops TO service_role;
ALTER TABLE public.curated_drops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS curated_drops_read ON public.curated_drops;
CREATE POLICY curated_drops_read ON public.curated_drops
  FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS curated_drops_admin_write ON public.curated_drops;
CREATE POLICY curated_drops_admin_write ON public.curated_drops
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER update_curated_drops_updated_at
BEFORE UPDATE ON public.curated_drops
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS curated_drops_region_idx ON public.curated_drops (target_region, is_active, sort_order);
