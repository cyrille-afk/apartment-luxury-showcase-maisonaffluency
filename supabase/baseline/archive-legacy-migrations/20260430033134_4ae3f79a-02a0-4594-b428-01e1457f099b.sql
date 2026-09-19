
UPDATE designer_curator_picks
SET size_variants = (
  SELECT jsonb_agg(
    CASE
      WHEN elem ? 'label' THEN
        jsonb_set(
          elem,
          '{label}',
          to_jsonb(
            -- 1. Fix missing closing paren: "(Ø 102 cm" -> "(Ø 102 cm)"
            regexp_replace(
              -- 2. Collapse multiple spaces into single space
              regexp_replace(elem->>'label', '\s+', ' ', 'g'),
              '\(([^)]+)$',
              '(\1)'
            )
          )
        )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(size_variants) AS elem
)
WHERE id = '7c0b01fc-b4be-44b1-b5f0-64d47efddadd';
