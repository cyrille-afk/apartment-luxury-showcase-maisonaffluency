UPDATE designer_curator_picks
SET size_variants = jsonb_build_array(
  jsonb_build_object('label','Pendant Small / Ø 13 cm','base','ETCHED GLASS ELONGATED','top','AGED BRASS [WAXED]','price_cents',345000),
  jsonb_build_object('label','Pendant Large / Ø 17 cm','base','ETCHED GLASS ELONGATED','top','AGED BRASS [WAXED]','price_cents',380000),
  jsonb_build_object('label','Pendant Small / Ø 13 cm','base','ETCHED GLASS ELONGATED','top','OIL-RUBBED BRONZE [WAXED]','price_cents',345000),
  jsonb_build_object('label','Pendant Large / Ø 17 cm','base','ETCHED GLASS ELONGATED','top','OIL-RUBBED BRONZE [WAXED]','price_cents',380000),
  jsonb_build_object('label','Pendant Small / Ø 13 cm','base','ETCHED GLASS ELONGATED','top','BLACKENED BRASS [WAXED]','price_cents',345000),
  jsonb_build_object('label','Pendant Large / Ø 17 cm','base','ETCHED GLASS ELONGATED','top','BLACKENED BRASS [WAXED]','price_cents',380000),
  jsonb_build_object('label','Pendant Small / Ø 13 cm','base','ETCHED GLASS ELONGATED','top','TARNISHED SILVER [LACQUERED]','price_cents',466000),
  jsonb_build_object('label','Pendant Large / Ø 17 cm','base','ETCHED GLASS ELONGATED','top','TARNISHED SILVER [LACQUERED]','price_cents',513000)
)
WHERE id = 'fd3b99c7-918e-4ecb-bf1c-546653e4fa20';