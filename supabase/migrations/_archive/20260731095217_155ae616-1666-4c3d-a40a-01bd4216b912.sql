INSERT INTO public.fabrics (name, description, image_url, category, supplier, is_active, sort_order)
SELECT
  replace(ms.name, ' · ', ' '),
  'Dagmar upholstery/finish option',
  ms.image_url,
  CASE WHEN ms.category IN ('Fabric','Leather') THEN 'Fabric & Leather' ELSE ms.category END,
  ms.material_type,
  true,
  0
FROM public.material_swatches ms
WHERE ms.brand_name = 'Dagmar'
  AND NOT EXISTS (
    SELECT 1 FROM public.fabrics f WHERE f.image_url = ms.image_url
  );