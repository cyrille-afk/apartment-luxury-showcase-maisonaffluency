
-- Refresh the 4 existing metal swatch URLs to v=3 (newly-recropped images uploaded to the same path)
UPDATE fabrics SET image_url = replace(image_url, '?v=2', '?v=3'), updated_at = now()
WHERE id IN (
  '420d3d1b-4aa2-434c-92db-cd415a623cd2',
  'e9c5a254-e79d-4c51-990f-c63a9de913f0',
  '7f3b7bd9-e0f6-410a-82a3-30158179a736',
  'fb473ffb-0da6-4ec9-ab1f-94578887b6fb'
);

-- Insert 11 new Apparatus finishes
WITH new_fabrics(name, category, image_url, sort_order) AS (
  VALUES
    ('Leather - Cane',    'Fabric & Leather', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-leather-cane.jpg',   1001),
    ('Leather - Saddle',  'Fabric & Leather', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-leather-saddle.jpg', 1002),
    ('Leather - Taupe',   'Fabric & Leather', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-leather-taupe.jpg',  1003),
    ('Leather - Black',   'Fabric & Leather', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-leather-black.jpg',  1004),
    ('Suede - Ice',       'Fabric & Leather', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-suede-ice.jpg',      1005),
    ('Suede - Pewter',    'Fabric & Leather', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-suede-pewter.jpg',   1006),
    ('Suede - Bronze',    'Fabric & Leather', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-suede-bronze.jpg',   1007),
    ('Suede - Sepia',     'Fabric & Leather', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-suede-sepia.jpg',    1008),
    ('Suede - Juniper',   'Fabric & Leather', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-suede-juniper.jpg',  1009),
    ('Suede - Plum',      'Fabric & Leather', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-suede-plum.jpg',     1010),
    ('Suede - Black',     'Fabric & Leather', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/apparatus/apparatus-suede-black.jpg',    1011)
),
inserted AS (
  INSERT INTO fabrics (name, category, image_url, supplier, sort_order, is_active)
  SELECT name, category, image_url, 'Apparatus', sort_order, true FROM new_fabrics
  RETURNING id, name
)
-- Link each new fabric to the Metronome Reading Floor Lamp pick
INSERT INTO product_fabrics (pick_id, fabric_id, sort_order, price_tier_label)
SELECT
  'bdcf9f7e-6bd3-4a97-b132-278aecd5912e'::uuid,
  i.id,
  4 + row_number() OVER (ORDER BY i.name),
  'Finish'
FROM inserted i;
