UPDATE designer_curator_picks
SET size_variants = (
  SELECT jsonb_agg(
    CASE WHEN v ? 'base' THEN jsonb_set(v, '{base}', to_jsonb(btrim(v->>'base'))) ELSE v END
    ORDER BY ord
  )
  FROM jsonb_array_elements(size_variants) WITH ORDINALITY AS t(v, ord)
)
WHERE id = 'be988b38-e8f9-402d-a7f1-7d8ffad9fae2';