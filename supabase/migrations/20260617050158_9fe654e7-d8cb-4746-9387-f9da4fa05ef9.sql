
-- 1) Mark all Garnier & Linker picks as non-upholstered
UPDATE designer_curator_picks
SET is_upholstered = false
WHERE designer_id = (SELECT id FROM designers WHERE name = 'Garnier & Linker')
  AND (is_upholstered IS DISTINCT FROM false);

-- 2) Link all 7 Garnier & Linker fabrics (5 Metal + 2 Alabaster) to each lighting pick
--    (exclude the crystal centerpiece, where metal patinas don't apply)
WITH gl_picks AS (
  SELECT id FROM designer_curator_picks
  WHERE designer_id = (SELECT id FROM designers WHERE name = 'Garnier & Linker')
    AND title <> 'Blue Lost-Wax Crystal Cast Centerpiece'
),
gl_fabrics AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY category DESC, name) - 1 AS sort_order
  FROM fabrics WHERE supplier = 'Garnier & Linker'
)
INSERT INTO product_fabrics (pick_id, fabric_id, sort_order)
SELECT p.id, f.id, f.sort_order
FROM gl_picks p
CROSS JOIN gl_fabrics f
ON CONFLICT DO NOTHING;
