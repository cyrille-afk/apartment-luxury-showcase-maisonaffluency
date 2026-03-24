-- Move Galea Lantern (sort_order 3) down to sort_order 8, shift others up
UPDATE designer_curator_picks SET sort_order = sort_order - 1 
WHERE designer_id = (SELECT id FROM designers WHERE slug = 'alexander-lamont') 
AND sort_order > 3 AND sort_order <= 8;

UPDATE designer_curator_picks SET sort_order = 8 
WHERE id = '200b1808-cbfd-45ab-bc1a-26f0dadf787b';