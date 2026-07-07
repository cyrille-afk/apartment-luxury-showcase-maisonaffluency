
-- 1. descriptor_taxonomy
CREATE TABLE public.descriptor_taxonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('construction','treatment','finish','feature','attribute','hardware')),
  synonyms text[] NOT NULL DEFAULT '{}',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX descriptor_taxonomy_category_idx ON public.descriptor_taxonomy(category) WHERE is_active;

GRANT SELECT ON public.descriptor_taxonomy TO anon, authenticated;
GRANT ALL ON public.descriptor_taxonomy TO service_role;
ALTER TABLE public.descriptor_taxonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read descriptor taxonomy" ON public.descriptor_taxonomy FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage descriptor taxonomy" ON public.descriptor_taxonomy FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER descriptor_taxonomy_set_updated_at BEFORE UPDATE ON public.descriptor_taxonomy
  FOR EACH ROW EXECUTE FUNCTION tms_set_updated_at();

-- 2. product_descriptor_links
CREATE TABLE public.product_descriptor_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.trade_products(id) ON DELETE CASCADE,
  pick_id uuid REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE,
  descriptor_id uuid NOT NULL REFERENCES public.descriptor_taxonomy(id) ON DELETE RESTRICT,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (product_id IS NOT NULL OR pick_id IS NOT NULL)
);
CREATE UNIQUE INDEX product_descriptor_links_product_unique ON public.product_descriptor_links(product_id, descriptor_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX product_descriptor_links_pick_unique ON public.product_descriptor_links(pick_id, descriptor_id) WHERE pick_id IS NOT NULL;
CREATE INDEX product_descriptor_links_descriptor_idx ON public.product_descriptor_links(descriptor_id);

GRANT SELECT ON public.product_descriptor_links TO anon, authenticated;
GRANT ALL ON public.product_descriptor_links TO service_role;
ALTER TABLE public.product_descriptor_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read product descriptor links" ON public.product_descriptor_links FOR SELECT USING (true);
CREATE POLICY "Admins manage product descriptor links" ON public.product_descriptor_links FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER product_descriptor_links_set_updated_at BEFORE UPDATE ON public.product_descriptor_links
  FOR EACH ROW EXECUTE FUNCTION tms_set_updated_at();

-- 3. Seed descriptors
INSERT INTO public.descriptor_taxonomy (slug, name, category, synonyms) VALUES
  -- construction
  ('foam', 'Foam', 'construction', ARRAY['foam','expanded foam','polyurethane foam','upholstery in different densities polyurethane foam','resinated layer']),
  ('frame', 'Frame', 'construction', ARRAY['frame','wooden frame','hand-curved frame','frame in solid','elastic belts frame']),
  ('base', 'Base', 'construction', ARRAY['base','bevelled edge base','slide feet','footrest']),
  ('cushion', 'Cushion', 'construction', ARRAY['cushion','removable cover cushions','compartmentalized feathers','plush upholstery']),
  ('upholstery', 'Upholstery', 'construction', ARRAY['upholstery','full upholstery','upholstered seat','seat','upholstered in a choice of fabrics','removable cover']),
  -- treatment
  ('stain-resistant-treatment', 'Stain-Resistant Treatment', 'treatment', ARRAY['stain-resistant treatment','stain resistant treatment']),
  ('protective-varnish', 'Protective Varnish', 'treatment', ARRAY['protective varnish','varnish']),
  ('patinated', 'Patinated', 'treatment', ARRAY['patinated','bronzed finish','hand-patinated aqua finish','a golden brown patina','patina']),
  ('polished', 'Polished', 'treatment', ARRAY['polished']),
  ('bleached', 'Bleached', 'treatment', ARRAY['bleached']),
  ('laser-cut', 'Laser-Cut', 'treatment', ARRAY['laser-cut','laser cut']),
  ('lost-wax-casting', 'Lost-Wax Casting', 'treatment', ARRAY['lost-wax casting','lost wax casting']),
  ('hand-assembled', 'Hand-Assembled', 'treatment', ARRAY['hand-assembled before final finishing','hand-assembled','hand assembled']),
  -- finish
  ('gold-leaf', 'Gold Leaf', 'finish', ARRAY['gold leaf','24k gold leaf rim','24k gold','24k gold leaf','gold-leaf']),
  ('layered-finish', 'Layered Finish', 'finish', ARRAY['18-21 layers hand-applied','layered finish']),
  ('matte-finish', 'Matte Finish', 'finish', ARRAY['mat','matte']),
  -- feature
  ('elastic-belts', 'Elastic Belts', 'feature', ARRAY['elastic belts']),
  ('marine-grade', 'Marine-Grade Outdoor', 'feature', ARRAY['316 marine outdoor version','marine outdoor','marine grade']),
  ('signed-edition', 'Signed', 'feature', ARRAY['signed']),
  ('paper-diffuser', 'Paper Diffuser', 'feature', ARRAY['white paper diffusing material','white paper diffuser','paper diffuser']),
  -- hardware
  ('e27-bulb-holder', 'E27 Bulb Holder', 'hardware', ARRAY['e27 bulb holder','e27']),
  ('pvc-lid', 'PVC Lid', 'hardware', ARRAY['pvc lid']),
  -- attribute
  ('solid-construction', 'Solid', 'attribute', ARRAY['solid']),
  ('curved-form', 'Curved', 'attribute', ARRAY['curved']),
  ('blown', 'Blown', 'attribute', ARRAY['blown']),
  ('mineral-tone', 'Mineral', 'attribute', ARRAY['mineral']);

-- 4. Populate links via word-boundary matching against materials text
WITH src AS (
  SELECT id AS pid, NULL::uuid AS kid, materials FROM trade_products WHERE materials IS NOT NULL AND materials <> ''
  UNION ALL
  SELECT NULL, id, materials FROM designer_curator_picks WHERE materials IS NOT NULL AND materials <> ''
),
tokens AS (
  SELECT pid, kid, lower(trim(regexp_replace(t, '\s+', ' ', 'g'))) AS token
  FROM src, LATERAL regexp_split_to_table(materials, '[·•,&/():\]\n]| and | with | or ') AS t
  WHERE length(trim(t)) > 1
),
descriptors AS (
  SELECT id, lower(unnest(synonyms)) AS syn FROM descriptor_taxonomy WHERE is_active
),
matches AS (
  SELECT DISTINCT t.pid, t.kid, d.id AS descriptor_id
  FROM tokens t JOIN descriptors d
    ON t.token ~ ('\m'||regexp_replace(d.syn,'([.+*?()\[\]{}|\\^$])','\\\1','g')||'\M')
)
INSERT INTO public.product_descriptor_links (product_id, pick_id, descriptor_id)
SELECT pid, kid, descriptor_id FROM matches
ON CONFLICT DO NOTHING;
