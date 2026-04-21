UPDATE public.designer_curator_picks
SET size_variants = '[
  {"base": "Powercoated & Gun Metal", "top": "Nero Marquina", "price_cents": 2105000},
  {"base": "Powercoated & Gun Metal", "top": "Carrara", "price_cents": 2105000},
  {"base": "Powercoated & Gun Metal", "top": "Calacatta", "price_cents": 2105000},
  {"base": "Powercoated & Gun Metal", "top": "Travertine marble", "price_cents": 2105000},
  {"base": "Brass", "top": "Nero Marquina", "price_cents": 2500000},
  {"base": "Brass", "top": "Carrara", "price_cents": 2500000},
  {"base": "Brass", "top": "Calacatta", "price_cents": 2500000},
  {"base": "Brass", "top": "Travertine marble", "price_cents": 2500000}
]'::jsonb,
materials = 'Powercoated & Gun Metal or Brass base; Stone top: Nero Marquina, Carrara, Calacatta, or Travertine marble.'
WHERE title = 'Tectra 2 Coffee Table';