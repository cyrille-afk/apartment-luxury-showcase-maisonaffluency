
ALTER TABLE public.descriptor_taxonomy
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Initialise sort_order per category based on current name ordering
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY category ORDER BY name) * 10 AS so
  FROM public.descriptor_taxonomy
)
UPDATE public.descriptor_taxonomy d
SET sort_order = r.so
FROM ranked r
WHERE r.id = d.id AND d.sort_order = 0;

CREATE INDEX IF NOT EXISTS descriptor_taxonomy_sort_idx
  ON public.descriptor_taxonomy(category, sort_order);

-- Admin-only remap function: clears all product_descriptor_links and rebuilds
-- from current synonyms using the same tokenizer + word-boundary matcher used
-- in the seed migration. Returns the new total link count.
CREATE OR REPLACE FUNCTION public.remap_product_descriptors()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.product_descriptor_links;

  WITH src AS (
    SELECT id AS pid, NULL::uuid AS kid, materials FROM public.trade_products
    WHERE materials IS NOT NULL AND materials <> ''
    UNION ALL
    SELECT NULL, id, materials FROM public.designer_curator_picks
    WHERE materials IS NOT NULL AND materials <> ''
  ),
  tokens AS (
    SELECT pid, kid, lower(trim(regexp_replace(t, '\s+', ' ', 'g'))) AS token
    FROM src, LATERAL regexp_split_to_table(materials, '[·•,&/():\]\n]| and | with | or ') AS t
    WHERE length(trim(t)) > 1
  ),
  descriptors AS (
    SELECT id, lower(unnest(synonyms)) AS syn
    FROM public.descriptor_taxonomy WHERE is_active
  ),
  matches AS (
    SELECT DISTINCT t.pid, t.kid, d.id AS descriptor_id
    FROM tokens t JOIN descriptors d
      ON t.token ~ ('\m'||regexp_replace(d.syn,'([.+*?()\[\]{}|\\^$])','\\\1','g')||'\M')
  )
  INSERT INTO public.product_descriptor_links (product_id, pick_id, descriptor_id)
  SELECT pid, kid, descriptor_id FROM matches
  ON CONFLICT DO NOTHING;

  SELECT count(*)::int INTO n FROM public.product_descriptor_links;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.remap_product_descriptors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remap_product_descriptors() TO authenticated;
