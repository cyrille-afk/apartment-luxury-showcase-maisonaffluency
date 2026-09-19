INSERT INTO public.product_fabrics (pick_id, fabric_id, sort_order)
SELECT p.id, f.id, 0
FROM public.designer_curator_picks p
CROSS JOIN public.fabrics f
WHERE p.designer_id = '274a57ec-d50f-471f-b549-754af6e335e8'
  AND f.description = 'Dagmar upholstery/finish option'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_fabrics pf WHERE pf.pick_id = p.id AND pf.fabric_id = f.id
  );