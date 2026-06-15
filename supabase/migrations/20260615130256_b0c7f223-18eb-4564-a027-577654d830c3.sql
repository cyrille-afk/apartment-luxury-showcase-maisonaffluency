
-- Rebuild Elephant Armchair size_variants matrix from Ecart catalog (P.23):
-- 8 wood finishes × fabric tier prices.
WITH variants AS (
  SELECT jsonb_agg(jsonb_build_object('base', base, 'top', top, 'label', '', 'price_cents', price_cents) || meters_obj ORDER BY ord_base, ord_top) AS sv
  FROM (
    SELECT base, top, price_cents,
           CASE WHEN top LIKE '%fabric%' THEN jsonb_build_object('meters', 3.5) ELSE '{}'::jsonb END AS meters_obj,
           ord_base, ord_top
    FROM (VALUES
      -- Smooth oak (3 finishes share same prices): 7000/7000/9500/13000/13500
      ('Smooth natural oak with matte varnish', 'ECART fabric (3.5 m)', 700000, 1, 1),
      ('Smooth natural oak with matte varnish', 'COM fabric (3.5 m)',   700000, 1, 2),
      ('Smooth natural oak with matte varnish', 'Leather',              950000, 1, 3),
      ('Smooth natural oak with matte varnish', 'Shearling',           1300000, 1, 4),
      ('Smooth natural oak with matte varnish', 'Hide',                1350000, 1, 5),
      ('Smooth brown oak with matte varnish',   'ECART fabric (3.5 m)', 700000, 2, 1),
      ('Smooth brown oak with matte varnish',   'COM fabric (3.5 m)',   700000, 2, 2),
      ('Smooth brown oak with matte varnish',   'Leather',              950000, 2, 3),
      ('Smooth brown oak with matte varnish',   'Shearling',           1300000, 2, 4),
      ('Smooth brown oak with matte varnish',   'Hide',                1350000, 2, 5),
      ('Smooth black oak with matte varnish',   'ECART fabric (3.5 m)', 700000, 3, 1),
      ('Smooth black oak with matte varnish',   'COM fabric (3.5 m)',   700000, 3, 2),
      ('Smooth black oak with matte varnish',   'Leather',              950000, 3, 3),
      ('Smooth black oak with matte varnish',   'Shearling',           1300000, 3, 4),
      ('Smooth black oak with matte varnish',   'Hide',                1350000, 3, 5),
      -- Sandblasted oak: 8000/8000/10000/13500/14000
      ('Sandblasted natural oak with matte varnish', 'ECART fabric (3.5 m)', 800000, 4, 1),
      ('Sandblasted natural oak with matte varnish', 'COM fabric (3.5 m)',   800000, 4, 2),
      ('Sandblasted natural oak with matte varnish', 'Leather',             1000000, 4, 3),
      ('Sandblasted natural oak with matte varnish', 'Shearling',           1350000, 4, 4),
      ('Sandblasted natural oak with matte varnish', 'Hide',                1400000, 4, 5),
      ('Sandblasted brown oak with matte varnish',   'ECART fabric (3.5 m)', 800000, 5, 1),
      ('Sandblasted brown oak with matte varnish',   'COM fabric (3.5 m)',   800000, 5, 2),
      ('Sandblasted brown oak with matte varnish',   'Leather',             1000000, 5, 3),
      ('Sandblasted brown oak with matte varnish',   'Shearling',           1350000, 5, 4),
      ('Sandblasted brown oak with matte varnish',   'Hide',                1400000, 5, 5),
      ('Sandblasted black oak with matte varnish',   'ECART fabric (3.5 m)', 800000, 6, 1),
      ('Sandblasted black oak with matte varnish',   'COM fabric (3.5 m)',   800000, 6, 2),
      ('Sandblasted black oak with matte varnish',   'Leather',             1000000, 6, 3),
      ('Sandblasted black oak with matte varnish',   'Shearling',           1350000, 6, 4),
      ('Sandblasted black oak with matte varnish',   'Hide',                1400000, 6, 5),
      -- Walnut: 8000/8000/10500/14000/15000
      ('Walnut', 'ECART fabric (3.5 m)', 800000, 7, 1),
      ('Walnut', 'COM fabric (3.5 m)',   800000, 7, 2),
      ('Walnut', 'Leather',             1050000, 7, 3),
      ('Walnut', 'Shearling',           1400000, 7, 4),
      ('Walnut', 'Hide',                1500000, 7, 5),
      -- Thermo-treated wood (outdoor): only fabric options
      ('Thermo-treated wood (outdoor)', 'ECART fabric (3.5 m)', 750000, 8, 1),
      ('Thermo-treated wood (outdoor)', 'COM fabric (3.5 m)',   750000, 8, 2)
    ) AS v(base, top, price_cents, ord_base, ord_top)
  ) ordered
)
UPDATE public.designer_curator_picks
SET size_variants = (SELECT sv FROM variants),
    trade_price_cents = 700000,
    base_axis_label = 'Frame',
    top_axis_label = 'Upholstery'
WHERE id = '1b6a0347-30e3-41e0-a464-5cc998bf6ce6';

-- Unlink the unidentified ECRT-CHA-6 wood swatch from this pick to keep wood
-- selector aligned with the priced base options.
DELETE FROM public.product_fabrics
WHERE pick_id = '1b6a0347-30e3-41e0-a464-5cc998bf6ce6'
  AND fabric_id = '306ecfcc-0823-4d09-b3b2-933f32d3af84';
