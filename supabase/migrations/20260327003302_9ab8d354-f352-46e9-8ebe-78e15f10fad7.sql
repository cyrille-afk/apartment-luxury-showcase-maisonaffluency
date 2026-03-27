UPDATE designer_curator_picks
SET tags = ARRAY['Re-edition']
WHERE designer_id IN (
  SELECT id FROM designers WHERE founder = 'Ecart'
)
AND (tags IS NULL OR NOT tags @> ARRAY['Re-edition']);