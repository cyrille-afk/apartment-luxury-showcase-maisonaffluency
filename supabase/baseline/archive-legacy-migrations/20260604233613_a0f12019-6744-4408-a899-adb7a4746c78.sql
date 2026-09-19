UPDATE public.designer_curator_picks
SET
  dimensions = 'W 79 cm × D 77 cm x H 67 cm',
  top_axis_label = 'Upholstery'
WHERE title = 'Amboseli Armchair'
  AND (
    COALESCE(dimensions, '') <> 'W 79 cm × D 77 cm x H 67 cm'
    OR COALESCE(top_axis_label, '') <> 'Upholstery'
  );

UPDATE public.trade_products
SET dimensions = 'W 79 cm × D 77 cm x H 67 cm'
WHERE product_name = 'Amboseli Armchair'
  AND COALESCE(dimensions, '') <> 'W 79 cm × D 77 cm x H 67 cm';