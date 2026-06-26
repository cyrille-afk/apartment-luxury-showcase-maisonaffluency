
WITH new_fabrics(name, category, image_url, sort) AS (
  VALUES
    ('Marble Alexander Black', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/marble-alexander-black.jpg', 100),
    ('Marble Arancio', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/marble-arancio.jpg', 101),
    ('Marble Matrix Leathered', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/marble-matrix-leathered.jpg', 102),
    ('Marble Naomi Silver', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/marble-naomi-silver.jpg', 103),
    ('Marble Onyx Serenity Cross Cut', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/marble-onyx-serenity-cross-cut.jpg', 104),
    ('Marble Onyx Serenity Vein Cut', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/marble-onyx-serenity-vein-cut.jpg', 105),
    ('Marble Tanya White', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/marble-tanya-white.jpg', 106),
    ('Marble Pastrana Wave', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/marble-pastrana-wave.jpg', 107),
    ('Marble Onyx Golden Coffee', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/marble-onyx-golden-coffee.jpg', 108),
    ('Marble Dayton Bianco', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/marble-dayton-bianco.jpg', 109),
    ('Lava Stone Full Glazed Crackle', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/lava-stone-full-glazed-crackle.jpg', 110),
    ('Lava Stone Full Glazed Crystal', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/lava-stone-full-glazed-crystal.jpg', 111),
    ('Lava Stone Crackled Crème Brûlée', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/lava-stone-crackled-creme-brulee.jpg', 112),
    ('Lava Stone Natural Crème Brûlée', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/lava-stone-natural-creme-brulee.jpg', 113),
    ('Lava Stone Sand Crème Brûlée', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/lava-stone-sand-creme-brulee.jpg', 114),
    ('Lava Stone Crème Brûlée', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/lava-stone-creme-brulee.jpg', 115),
    ('Lava Stone Black Crème Brûlée', 'Stone', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/pendhapa/lava-stone-black-creme-brulee.jpg', 116)
),
inserted AS (
  INSERT INTO public.fabrics (name, category, supplier, image_url, sort_order, is_active)
  SELECT name, category, 'Atelier Pendhapa', image_url, sort, true FROM new_fabrics
  ON CONFLICT DO NOTHING
  RETURNING id, name, sort_order
)
INSERT INTO public.product_fabrics (pick_id, fabric_id, sort_order)
SELECT '2e452f3b-502a-4d3a-8505-731b68098228'::uuid, id, sort_order
FROM inserted
ON CONFLICT (pick_id, fabric_id) DO NOTHING;
