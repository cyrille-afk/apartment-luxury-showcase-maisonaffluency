
-- 1. Typed dimensions + contract grade on curator picks (trade_products already has these)
ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS width_mm integer,
  ADD COLUMN IF NOT EXISTS depth_mm integer,
  ADD COLUMN IF NOT EXISTS height_mm integer,
  ADD COLUMN IF NOT EXISTS seat_height_mm integer,
  ADD COLUMN IF NOT EXISTS is_contract_grade boolean NOT NULL DEFAULT false;

ALTER TABLE public.designer_curator_picks
  ADD CONSTRAINT designer_curator_picks_width_mm_check   CHECK (width_mm   IS NULL OR (width_mm   BETWEEN 1 AND 20000)),
  ADD CONSTRAINT designer_curator_picks_depth_mm_check   CHECK (depth_mm   IS NULL OR (depth_mm   BETWEEN 1 AND 20000)),
  ADD CONSTRAINT designer_curator_picks_height_mm_check  CHECK (height_mm  IS NULL OR (height_mm  BETWEEN 1 AND 20000)),
  ADD CONSTRAINT designer_curator_picks_seat_height_mm_check CHECK (seat_height_mm IS NULL OR (seat_height_mm BETWEEN 1 AND 5000));

-- 2. Canonical materials reference
CREATE TABLE IF NOT EXISTS public.material_taxonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  family text NOT NULL CHECK (family IN (
    'wood','metal','stone','fabric','leather','glass','ceramic','composite','plastic','paper','other'
  )),
  synonyms text[] NOT NULL DEFAULT '{}',
  description text,
  is_contract_grade boolean NOT NULL DEFAULT false,
  durability_rating smallint CHECK (durability_rating IS NULL OR durability_rating BETWEEN 1 AND 5),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.material_taxonomy TO anon, authenticated;
GRANT ALL   ON public.material_taxonomy TO service_role;

ALTER TABLE public.material_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read material taxonomy"
  ON public.material_taxonomy FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage material taxonomy"
  ON public.material_taxonomy FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS material_taxonomy_family_idx ON public.material_taxonomy (family) WHERE is_active;

CREATE TRIGGER material_taxonomy_set_updated_at
  BEFORE UPDATE ON public.material_taxonomy
  FOR EACH ROW EXECUTE FUNCTION tms_set_updated_at();

-- 3. Junction — product / pick → material with typed role
CREATE TABLE IF NOT EXISTS public.product_material_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.trade_products(id) ON DELETE CASCADE,
  pick_id    uuid REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.material_taxonomy(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'primary' CHECK (role IN (
    'primary','secondary','finish','upholstery','structural','hardware','base','trim','inlay'
  )),
  position_note text,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_material_links_target_ck CHECK (
    (product_id IS NOT NULL) OR (pick_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX product_material_links_product_unique
  ON public.product_material_links (product_id, material_id, role)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX product_material_links_pick_unique
  ON public.product_material_links (pick_id, material_id, role)
  WHERE pick_id IS NOT NULL;

CREATE INDEX product_material_links_product_idx ON public.product_material_links (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX product_material_links_pick_idx    ON public.product_material_links (pick_id)    WHERE pick_id IS NOT NULL;
CREATE INDEX product_material_links_material_idx ON public.product_material_links (material_id);

GRANT SELECT ON public.product_material_links TO anon, authenticated;
GRANT ALL    ON public.product_material_links TO service_role;

ALTER TABLE public.product_material_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read product material links"
  ON public.product_material_links FOR SELECT
  USING (true);

CREATE POLICY "Admins manage product material links"
  ON public.product_material_links FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER product_material_links_set_updated_at
  BEFORE UPDATE ON public.product_material_links
  FOR EACH ROW EXECUTE FUNCTION tms_set_updated_at();

-- 4. Extend curator → trade sync to mirror new typed columns
CREATE OR REPLACE FUNCTION public.sync_curator_pick_to_trade_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _brand_name text;
  _existing_id uuid;
  _rrp_cents integer;
  _pick_age_sec numeric;
BEGIN
  SELECT name INTO _brand_name FROM public.designers WHERE id = NEW.designer_id;
  IF _brand_name IS NULL OR NEW.title IS NULL OR btrim(NEW.title) = '' THEN
    RETURN NEW;
  END IF;

  _rrp_cents := NEW.trade_price_cents;

  SELECT id INTO _existing_id
  FROM public.trade_products
  WHERE source_pick_id = NEW.id
  LIMIT 1;

  IF _existing_id IS NULL THEN
    SELECT id INTO _existing_id
    FROM public.trade_products
    WHERE brand_name = _brand_name AND product_name = NEW.title
    LIMIT 1;
  END IF;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.trade_products tp
    SET
      product_name          = NEW.title,
      source_pick_id        = NEW.id,
      trade_price_cents     = COALESCE(NEW.trade_price_cents,     tp.trade_price_cents),
      rrp_price_cents       = COALESCE(_rrp_cents,                tp.rrp_price_cents),
      price_per_sqm_cents   = COALESCE(NEW.price_per_sqm_cents,   tp.price_per_sqm_cents),
      currency              = COALESCE(NULLIF(NEW.currency, ''),  tp.currency),
      category              = COALESCE(NULLIF(NEW.category, ''),  tp.category),
      lead_time             = NULLIF(NEW.lead_time, ''),
      dimensions            = NULLIF(NEW.dimensions, ''),
      materials             = NULLIF(NEW.materials, ''),
      description           = NULLIF(NEW.description, ''),
      image_url             = NULLIF(NEW.image_url, ''),
      subcategory           = NULLIF(NEW.subcategory, ''),
      origin                = NULLIF(NEW.origin, ''),
      price_prefix          = NULLIF(NEW.price_prefix, ''),
      gallery_images        = NEW.gallery_images,
      spec_sheet_url        = NULLIF(NEW.pdf_url, ''),
      pdf_urls              = NEW.pdf_urls,
      pack_cbm              = NEW.pack_cbm,
      pack_weight_kg        = NEW.pack_weight_kg,
      pack_carton_count     = NEW.pack_carton_count,
      default_ship_mode     = NULLIF(NEW.default_ship_mode, ''),
      pickup_country        = NULLIF(NEW.pickup_country, ''),
      pickup_postcode       = NULLIF(NEW.pickup_postcode, ''),
      pickup_address        = NULLIF(NEW.pickup_address, ''),
      hs_code               = NULLIF(NEW.hs_code, ''),
      is_upholstered        = NEW.is_upholstered,
      size_variants         = NEW.size_variants,
      variant_image_map     = NEW.variant_image_map,
      base_axis_label       = NULLIF(NEW.base_axis_label, ''),
      top_axis_label        = NULLIF(NEW.top_axis_label, ''),
      variant_placeholder   = NULLIF(NEW.variant_placeholder, ''),
      wood_label_override   = NULLIF(NEW.wood_label_override, ''),
      width_mm              = COALESCE(NEW.width_mm,          tp.width_mm),
      depth_mm              = COALESCE(NEW.depth_mm,          tp.depth_mm),
      height_mm             = COALESCE(NEW.height_mm,         tp.height_mm),
      seat_height_mm        = COALESCE(NEW.seat_height_mm,    tp.seat_height_mm),
      is_contract_grade     = NEW.is_contract_grade,
      is_active             = true,
      updated_at            = now()
    WHERE tp.id = _existing_id;
    RETURN NEW;
  END IF;

  _pick_age_sec := EXTRACT(EPOCH FROM (now() - NEW.created_at));
  IF char_length(btrim(NEW.title)) < 6
     OR NULLIF(btrim(COALESCE(NEW.image_url, '')), '') IS NULL
     OR _pick_age_sec < 5 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.trade_products (
    brand_name, product_name, category, subcategory,
    trade_price_cents, rrp_price_cents, price_per_sqm_cents, currency,
    dimensions, materials, description,
    lead_time, image_url, gallery_images,
    spec_sheet_url, pdf_urls, origin, price_prefix,
    pack_cbm, pack_weight_kg, pack_carton_count,
    default_ship_mode, pickup_country, pickup_postcode, pickup_address,
    hs_code, is_upholstered,
    size_variants, variant_image_map,
    base_axis_label, top_axis_label, variant_placeholder, wood_label_override,
    width_mm, depth_mm, height_mm, seat_height_mm, is_contract_grade,
    is_active, source_pick_id
  )
  VALUES (
    _brand_name, NEW.title,
    COALESCE(NULLIF(NEW.category,''), 'Other'),
    NULLIF(NEW.subcategory,''),
    NEW.trade_price_cents, _rrp_cents, NEW.price_per_sqm_cents,
    COALESCE(NULLIF(NEW.currency,''), 'EUR'),
    NULLIF(NEW.dimensions,''), NULLIF(NEW.materials,''), NULLIF(NEW.description,''),
    NULLIF(NEW.lead_time,''), NULLIF(NEW.image_url,''), NEW.gallery_images,
    NULLIF(NEW.pdf_url,''), NEW.pdf_urls, NULLIF(NEW.origin,''), NULLIF(NEW.price_prefix,''),
    NEW.pack_cbm, NEW.pack_weight_kg, NEW.pack_carton_count,
    NULLIF(NEW.default_ship_mode,''), NULLIF(NEW.pickup_country,''),
    NULLIF(NEW.pickup_postcode,''), NULLIF(NEW.pickup_address,''),
    NULLIF(NEW.hs_code,''), NEW.is_upholstered,
    NEW.size_variants, NEW.variant_image_map,
    NULLIF(NEW.base_axis_label,''), NULLIF(NEW.top_axis_label,''),
    NULLIF(NEW.variant_placeholder,''), NULLIF(NEW.wood_label_override,''),
    NEW.width_mm, NEW.depth_mm, NEW.height_mm, NEW.seat_height_mm, NEW.is_contract_grade,
    true, NEW.id
  );
  RETURN NEW;
END;
$function$;

-- Retrigger definition with the extra columns in UPDATE OF list
DROP TRIGGER IF EXISTS trg_sync_curator_pick_to_trade_product ON public.designer_curator_picks;
CREATE TRIGGER trg_sync_curator_pick_to_trade_product
AFTER INSERT OR UPDATE OF
  title, subtitle, designer_id, category, subcategory, materials, dimensions,
  description, pdf_url, pdf_urls, currency, lead_time, price_prefix, gallery_images,
  origin, size_variants, variant_placeholder, base_axis_label, top_axis_label,
  variant_image_map, is_hidden, trade_price_cents, price_per_sqm_cents, pack_cbm,
  pack_weight_kg, pack_carton_count, default_ship_mode, pickup_country, pickup_postcode,
  pickup_address, hs_code, is_upholstered, wood_label_override, image_url, hover_image_url,
  width_mm, depth_mm, height_mm, seat_height_mm, is_contract_grade
ON public.designer_curator_picks
FOR EACH ROW EXECUTE FUNCTION public.sync_curator_pick_to_trade_product();

-- 5. Seed canonical materials
INSERT INTO public.material_taxonomy (slug, name, family, synonyms, is_contract_grade, durability_rating) VALUES
  ('oak',                'Oak',                'wood',   ARRAY['european oak','white oak','red oak'], true, 5),
  ('cerused-oak',        'Cerused Oak',        'wood',   ARRAY['limed oak'], true, 5),
  ('smoked-oak',         'Smoked Oak',         'wood',   ARRAY['fumed oak'], true, 5),
  ('walnut',             'Walnut',             'wood',   ARRAY['american walnut','black walnut','canaletto walnut'], true, 4),
  ('ash',                'Ash',                'wood',   ARRAY['european ash'], true, 4),
  ('maple',              'Maple',              'wood',   ARRAY[]::text[], true, 4),
  ('teak',               'Teak',               'wood',   ARRAY['burmese teak'], true, 5),
  ('mahogany',           'Mahogany',           'wood',   ARRAY[]::text[], true, 4),
  ('ebony',              'Ebony',              'wood',   ARRAY['macassar ebony'], false, 3),
  ('rattan',             'Rattan',             'wood',   ARRAY['cane','wicker'], false, 3),
  ('bamboo',             'Bamboo',             'wood',   ARRAY[]::text[], false, 3),
  ('brass',              'Brass',              'metal',  ARRAY['polished brass','brushed brass','patinated brass','antique brass'], true, 5),
  ('bronze',             'Bronze',             'metal',  ARRAY['patinated bronze','oxidised bronze'], true, 5),
  ('steel',              'Steel',              'metal',  ARRAY['blackened steel','powder-coated steel','matte black steel'], true, 5),
  ('stainless-steel',    'Stainless Steel',    'metal',  ARRAY['brushed stainless','polished stainless'], true, 5),
  ('aluminium',          'Aluminium',          'metal',  ARRAY['aluminum','anodised aluminium'], true, 4),
  ('copper',             'Copper',             'metal',  ARRAY['patinated copper'], false, 4),
  ('iron',               'Iron',               'metal',  ARRAY['wrought iron','cast iron'], false, 4),
  ('marble',             'Marble',             'stone',  ARRAY['carrara marble','calacatta marble','statuario marble','nero marquina','emperador marble'], true, 4),
  ('travertine',         'Travertine',         'stone',  ARRAY['roman travertine'], true, 4),
  ('limestone',          'Limestone',          'stone',  ARRAY['french limestone'], true, 4),
  ('onyx',               'Onyx',               'stone',  ARRAY[]::text[], false, 3),
  ('granite',            'Granite',            'stone',  ARRAY[]::text[], true, 5),
  ('slate',              'Slate',              'stone',  ARRAY[]::text[], true, 4),
  ('terrazzo',           'Terrazzo',           'stone',  ARRAY[]::text[], true, 5),
  ('boucle',             'Bouclé',             'fabric', ARRAY['boucle','looped wool'], true, 4),
  ('linen',              'Linen',              'fabric', ARRAY['belgian linen','washed linen'], true, 3),
  ('cotton',             'Cotton',             'fabric', ARRAY[]::text[], false, 3),
  ('wool',               'Wool',               'fabric', ARRAY['virgin wool'], true, 4),
  ('velvet',             'Velvet',             'fabric', ARRAY['mohair velvet','cotton velvet'], true, 4),
  ('mohair',             'Mohair',             'fabric', ARRAY[]::text[], true, 5),
  ('cashmere',           'Cashmere',           'fabric', ARRAY[]::text[], false, 3),
  ('silk',               'Silk',               'fabric', ARRAY[]::text[], false, 2),
  ('leather',            'Leather',            'leather',ARRAY['full-grain leather','aniline leather','saddle leather','vegetable-tanned leather'], true, 5),
  ('nubuck',             'Nubuck',             'leather',ARRAY[]::text[], false, 3),
  ('suede',              'Suede',              'leather',ARRAY[]::text[], false, 3),
  ('parchment',           'Parchment',         'leather',ARRAY['shagreen','vellum'], false, 2),
  ('glass-clear',        'Clear Glass',        'glass',  ARRAY['float glass','crystal glass'], true, 4),
  ('glass-smoked',       'Smoked Glass',       'glass',  ARRAY['bronze glass'], true, 4),
  ('mirror',             'Mirror',             'glass',  ARRAY['antiqued mirror','patinated mirror'], true, 4),
  ('murano-glass',       'Murano Glass',       'glass',  ARRAY['hand-blown murano'], false, 3),
  ('ceramic',            'Ceramic',            'ceramic',ARRAY['glazed ceramic'], true, 4),
  ('porcelain',          'Porcelain',          'ceramic',ARRAY[]::text[], true, 4),
  ('lacquer',            'Lacquer',            'composite', ARRAY['high-gloss lacquer','matte lacquer'], true, 4),
  ('resin',              'Resin',              'composite', ARRAY['cast resin','pigmented resin'], true, 4),
  ('plaster',            'Plaster',            'composite', ARRAY['polished plaster','tadelakt'], false, 3),
  ('gesso',              'Gesso',              'composite', ARRAY[]::text[], false, 2),
  ('mdf',                'MDF',                'composite', ARRAY['medium-density fibreboard'], false, 3),
  ('plywood',            'Plywood',            'composite', ARRAY['bent plywood'], true, 4)
ON CONFLICT (slug) DO NOTHING;
