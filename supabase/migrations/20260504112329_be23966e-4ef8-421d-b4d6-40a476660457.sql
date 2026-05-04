UPDATE public.designer_curator_picks
SET variant_image_map = COALESCE(variant_image_map, '{}'::jsonb) || jsonb_build_object(
  'bleachedlimedandoak|customersownmaterialcom', 0,
  'bleachedoak|customersownmaterialcom', 1,
  'gougebronzelight|customersownmaterialcom', 5,
  'gougedarkbronze|customersownmaterialcom', 5,
  'bleachedoak|nimbusfabricdedar', 1,
  'gougedarkbronze|nimbusfabricdedar', 5
)
WHERE id = 'c3f66134-3b3c-4035-9f84-4290bf422be6';