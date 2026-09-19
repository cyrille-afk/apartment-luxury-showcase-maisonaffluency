UPDATE public.designer_curator_picks SET lead_time = '14 weeks' WHERE id = '5f1c1f30-3f57-4b25-9c0b-04a1fb1e1e30' AND lead_time IS NULL;

UPDATE public.trade_products SET lead_time = '14 weeks', lead_time_weeks_min = 14, lead_time_weeks_max = 14 WHERE id IN ('acef5475-58e2-4d39-89fe-0d46d002220a','e79957fa-6b06-4857-acce-3a2a687dadd8') AND lead_time IS NULL;