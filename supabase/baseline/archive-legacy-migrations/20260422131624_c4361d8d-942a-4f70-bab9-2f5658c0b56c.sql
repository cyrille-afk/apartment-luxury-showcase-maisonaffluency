UPDATE designer_curator_picks
SET size_variants = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'base', trim(v->>'base'),
      'top', trim(v->>'label'),
      'label', '',
      'price_cents', (v->>'price_cents')::int
    )
  )
  FROM jsonb_array_elements(size_variants) v
)
WHERE id = 'fbf6011c-6412-4528-876e-13bc95b53ee3';