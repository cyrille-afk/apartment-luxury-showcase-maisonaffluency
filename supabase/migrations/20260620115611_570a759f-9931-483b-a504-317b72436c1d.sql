UPDATE designer_curator_picks
SET 
  is_upholstered = false,
  base_axis_label = 'Lid Finish',
  top_axis_label = 'Sphere',
  size_variants = jsonb_build_array(
    jsonb_build_object('label','Pendant Small / Ø 13 cm · Height to order','base','AGED BRASS [WAXED]','top','ETCHED GLASS ELONGATED','price_cents',345000),
    jsonb_build_object('label','Pendant Large / Ø 17 cm · Height to order','base','AGED BRASS [WAXED]','top','ETCHED GLASS ELONGATED','price_cents',380000),
    jsonb_build_object('label','Pendant Small / Ø 13 cm · Height to order','base','OIL-RUBBED BRONZE [WAXED]','top','ETCHED GLASS ELONGATED','price_cents',345000),
    jsonb_build_object('label','Pendant Large / Ø 17 cm · Height to order','base','OIL-RUBBED BRONZE [WAXED]','top','ETCHED GLASS ELONGATED','price_cents',380000),
    jsonb_build_object('label','Pendant Small / Ø 13 cm · Height to order','base','BLACKENED BRASS [WAXED]','top','ETCHED GLASS ELONGATED','price_cents',345000),
    jsonb_build_object('label','Pendant Large / Ø 17 cm · Height to order','base','BLACKENED BRASS [WAXED]','top','ETCHED GLASS ELONGATED','price_cents',380000),
    jsonb_build_object('label','Pendant Small / Ø 13 cm · Height to order','base','TARNISHED SILVER [LACQUERED]','top','ETCHED GLASS ELONGATED','price_cents',466000),
    jsonb_build_object('label','Pendant Large / Ø 17 cm · Height to order','base','TARNISHED SILVER [LACQUERED]','top','ETCHED GLASS ELONGATED','price_cents',513000)
  )
WHERE id = 'fd3b99c7-918e-4ecb-bf1c-546653e4fa20';