UPDATE public.designer_curator_picks
SET size_variants = (size_variants::jsonb || jsonb_build_array(
  jsonb_build_object('top','', 'base','Silk Georgette Marble',    'label','Ø 137 × H 74 cm', 'price_cents', 3300000),
  jsonb_build_object('top','', 'base','Bianco Arabescato Marble', 'label','Ø 137 × H 74 cm', 'price_cents', 3300000),
  jsonb_build_object('top','', 'base','Navona Travertine',        'label','Ø 137 × H 74 cm', 'price_cents', 3300000),
  jsonb_build_object('top','', 'base','Silver Travertine',        'label','Ø 137 × H 74 cm', 'price_cents', 3300000)
))
WHERE id = '8776f13d-9b7b-410b-bcd4-0675e1213af2';