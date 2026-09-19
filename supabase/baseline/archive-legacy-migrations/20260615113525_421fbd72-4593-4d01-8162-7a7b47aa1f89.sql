
INSERT INTO public.fabrics (name, supplier, category, image_url, is_active, currency)
SELECT 'ECRT-CH-7', 'Ecart', 'Wood', 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/fabrics/ecart/ecrt-ch-7.jpg', true, 'EUR'
WHERE NOT EXISTS (SELECT 1 FROM public.fabrics WHERE name = 'ECRT-CH-7');

INSERT INTO public.product_fabrics (pick_id, fabric_id, sort_order)
SELECT '0d33b077-dc1a-4aed-bc8e-86dd2884b2dd'::uuid, f.id,
  CASE f.name
    WHEN 'ECRT-CH-7' THEN 101
    WHEN 'ECRT-CH-9' THEN 102
    WHEN 'ECRT-CH-8' THEN 103
    WHEN 'ECRT-CH-12' THEN 104
    WHEN 'ECRT-CH-14' THEN 105
    WHEN 'ECRT-CH-13' THEN 106
    WHEN 'ECRT-CHA-6' THEN 107
  END
FROM public.fabrics f
WHERE f.name IN ('ECRT-CH-7','ECRT-CH-8','ECRT-CH-9','ECRT-CH-12','ECRT-CH-13','ECRT-CH-14','ECRT-CHA-6')
AND NOT EXISTS (
  SELECT 1 FROM public.product_fabrics pf
  WHERE pf.pick_id = '0d33b077-dc1a-4aed-bc8e-86dd2884b2dd'::uuid AND pf.fabric_id = f.id
);
