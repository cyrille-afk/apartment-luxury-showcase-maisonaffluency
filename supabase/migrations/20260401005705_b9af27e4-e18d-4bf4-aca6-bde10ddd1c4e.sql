
-- Bulk update Instagram links for designers identified in conversation
-- Ferréol Babin
UPDATE designers SET links = '[{"type": "Instagram", "url": "https://www.instagram.com/ferreol_babin/"}]'::jsonb
WHERE name = 'Ferréol Babin' AND (links IS NULL OR links = '[]'::jsonb);

-- Cazes & Conquet (Thierry Conquet's Instagram)
UPDATE designers SET links = '[{"type": "Instagram", "url": "https://www.instagram.com/thierryconquet/"}]'::jsonb
WHERE name = 'Cazes & Conquet' AND (links IS NULL OR links = '[]'::jsonb);

-- Maarten De Ceulaer
UPDATE designers SET links = '[{"type": "Instagram", "url": "https://www.instagram.com/maartendeceulaer/"}]'::jsonb
WHERE name = 'Maarten De Ceulaer' AND (links IS NULL OR links = '[]'::jsonb);

-- Made in Kira - Roman Frankel
UPDATE designers SET links = '[{"type": "Instagram", "url": "https://www.instagram.com/madeinkira/"}]'::jsonb
WHERE name = 'Made in Kira - Roman Frankel' AND (links IS NULL OR links = '[]'::jsonb);

-- Marcantonio Brandolini D'Adda
UPDATE designers SET links = '[{"type": "Instagram", "url": "https://www.instagram.com/marcantoniobrandolinistudio/"}]'::jsonb
WHERE name = 'Marcantonio Brandolini D''Adda' AND (links IS NULL OR links = '[]'::jsonb);

-- Michel Jouannet (Ozone Light)
UPDATE designers SET links = '[{"type": "Instagram", "url": "https://www.instagram.com/ozone_light/"}]'::jsonb
WHERE name = 'Michel Jouannet' AND (links IS NULL OR links = '[]'::jsonb);

-- Ozone entries (also Ozone Light)
UPDATE designers SET links = '[{"type": "Instagram", "url": "https://www.instagram.com/ozone_light/"}]'::jsonb
WHERE name = 'Ozone' AND (links IS NULL OR links = '[]'::jsonb);

-- Overgaard & Dyrman
UPDATE designers SET links = '[{"type": "Instagram", "url": "https://www.instagram.com/overgaard_dyrman/"}]'::jsonb
WHERE name = 'Overgaard & Dyrman' AND (links IS NULL OR links = '[]'::jsonb);

-- Pierre Chareau → Ecart Paris
UPDATE designers SET links = '[{"type": "Instagram", "url": "https://www.instagram.com/ecart.paris/"}]'::jsonb
WHERE name = 'Pierre Chareau' AND (links IS NULL OR links = '[]'::jsonb);

-- Ecart → also Ecart Paris
UPDATE designers SET links = '[{"type": "Instagram", "url": "https://www.instagram.com/ecart.paris/"}]'::jsonb
WHERE name = 'Ecart' AND (links IS NULL OR links = '[]'::jsonb);
