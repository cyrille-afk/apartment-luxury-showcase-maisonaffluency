UPDATE designer_curator_picks SET trade_price_cents = 1500000, currency = 'EUR' WHERE title = 'Soleil Coffee Table' AND designer_id = (SELECT id FROM designers WHERE slug = 'ecart');

UPDATE designer_curator_picks SET trade_price_cents = 950000, currency = 'EUR' WHERE title = 'Elephant Armchair' AND designer_id = (SELECT id FROM designers WHERE slug = 'ecart');

UPDATE designer_curator_picks SET trade_price_cents = 350000, currency = 'EUR' WHERE title = 'X Stool (Round)' AND designer_id = (SELECT id FROM designers WHERE slug = 'ecart');

UPDATE designer_curator_picks SET trade_price_cents = 480000, currency = 'EUR' WHERE title = 'Croisillon Lamp' AND designer_id = (SELECT id FROM designers WHERE slug = 'ecart');

UPDATE designer_curator_picks SET trade_price_cents = 1200000, currency = 'EUR' WHERE title = 'Upholstered Back 3-Seater Sofa' AND designer_id = (SELECT id FROM designers WHERE slug = 'ecart');

UPDATE designer_curator_picks SET trade_price_cents = 850000, currency = 'EUR' WHERE title = 'Round Table' AND designer_id = (SELECT id FROM designers WHERE slug = 'ecart');