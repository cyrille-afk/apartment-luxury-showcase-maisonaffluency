
WITH new_fabrics(name, category, image_url, sort_order) AS (
  VALUES
    ('Ash Wood - Bleached',        'Wood',  'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-ash-wood-bleached.jpg',         2001),
    ('Ash Wood - Blackened',       'Wood',  'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-ash-wood-blackened.jpg',        2002),
    ('Travertine - Navona',        'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-travertine-navona.jpg',         2003),
    ('Travertine - Silver',        'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-travertine-silver.jpg',         2004),
    ('Marble - Bianco Arabescato', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-marble-bianco-arabescato.jpg',  2005),
    ('Marble - Nero Kinitra',      'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-marble-nero-kinitra.jpg',       2006),
    ('Marble - Silk Georgette',    'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-marble-silk-georgette.jpg',     2007),
    ('Marble - Lumachella',        'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-marble-lumachella.jpg',         2008),
    ('Marble - Nero Portoro',      'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-marble-nero-portoro.jpg',       2009)
),
inserted AS (
  INSERT INTO fabrics (name, category, image_url, supplier, sort_order, is_active)
  SELECT name, category, image_url, 'Apparatus', sort_order, true FROM new_fabrics
  RETURNING id, name, sort_order
)
-- Remove wrong metal links on Portal Dining Table, then add the correct wood/stone links
, _del AS (
  DELETE FROM product_fabrics WHERE pick_id = '8776f13d-9b7b-410b-bcd4-0675e1213af2'::uuid RETURNING 1
)
INSERT INTO product_fabrics (pick_id, fabric_id, sort_order, price_tier_label)
SELECT
  '8776f13d-9b7b-410b-bcd4-0675e1213af2'::uuid,
  i.id,
  row_number() OVER (ORDER BY i.sort_order),
  'Finish'
FROM inserted i;
