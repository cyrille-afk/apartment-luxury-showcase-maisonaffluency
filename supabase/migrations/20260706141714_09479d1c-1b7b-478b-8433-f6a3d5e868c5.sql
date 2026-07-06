
DELETE FROM public.product_material_links;

WITH src AS (
  SELECT id AS product_id, NULL::uuid AS pick_id, materials FROM public.trade_products WHERE materials IS NOT NULL AND materials <> ''
  UNION ALL
  SELECT NULL::uuid, id, materials FROM public.designer_curator_picks WHERE materials IS NOT NULL AND materials <> ''
),
tokens AS (
  SELECT s.product_id, s.pick_id, LOWER(TRIM(t)) AS token
  FROM src s,
  LATERAL regexp_split_to_table(
    regexp_replace(s.materials, '[·•,&/():]|\s+and\s+|\s+with\s+|\s+or\s+', '|', 'gi'),
    '\|'
  ) AS t
  WHERE LENGTH(TRIM(t)) > 0
),
terms AS (
  SELECT id AS material_id, LOWER(name) AS term FROM public.material_taxonomy WHERE LENGTH(name) >= 3
  UNION
  SELECT id, LOWER(s) FROM public.material_taxonomy, LATERAL unnest(COALESCE(synonyms,'{}')) s WHERE LENGTH(s) >= 3
)
INSERT INTO public.product_material_links (product_id, pick_id, material_id, role)
SELECT DISTINCT tk.product_id, tk.pick_id, tr.material_id, 'primary'
FROM tokens tk
JOIN terms tr
  ON tk.token ~ ('\m' || regexp_replace(tr.term, '([().+*?\[\]{}|^$\\])', '\\\1', 'g') || '\M')
ON CONFLICT DO NOTHING;
