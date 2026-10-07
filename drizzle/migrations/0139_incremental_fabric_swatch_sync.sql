-- Replace the TRUNCATE-and-rebuild swatch mirror (ACCESS EXCLUSIVE lock on every
-- finish edit, blocking public readers and causing statement timeouts) with a
-- targeted refresh of only the affected picks.

CREATE OR REPLACE FUNCTION public.refresh_product_fabric_swatches_for_picks(_pick_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _pick_ids IS NULL OR cardinality(_pick_ids) = 0 THEN
    RETURN;
  END IF;

  DELETE FROM public.product_fabric_swatches_public s
  WHERE s.pick_id = ANY(_pick_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.product_fabrics pf
      JOIN public.fabrics f ON f.id = pf.fabric_id
      WHERE pf.pick_id = s.pick_id AND pf.fabric_id = s.fabric_id AND f.is_active = true
    );

  INSERT INTO public.product_fabric_swatches_public (
    pick_id, fabric_id, sort_order, price_tier_label, image_indices,
    name, image_url, category, supplier, is_active, updated_at
  )
  SELECT
    pf.pick_id, pf.fabric_id, pf.sort_order, pf.price_tier_label, pf.image_indices,
    f.name, f.image_url, f.category, f.supplier, f.is_active, now()
  FROM public.product_fabrics pf
  JOIN public.fabrics f ON f.id = pf.fabric_id
  WHERE f.is_active = true
    AND pf.pick_id = ANY(_pick_ids)
  ON CONFLICT (pick_id, fabric_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    price_tier_label = EXCLUDED.price_tier_label,
    image_indices = EXCLUDED.image_indices,
    name = EXCLUDED.name,
    image_url = EXCLUDED.image_url,
    category = EXCLUDED.category,
    supplier = EXCLUDED.supplier,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at
  WHERE (product_fabric_swatches_public.sort_order, product_fabric_swatches_public.price_tier_label,
         product_fabric_swatches_public.image_indices, product_fabric_swatches_public.name,
         product_fabric_swatches_public.image_url, product_fabric_swatches_public.category,
         product_fabric_swatches_public.supplier, product_fabric_swatches_public.is_active)
    IS DISTINCT FROM
        (EXCLUDED.sort_order, EXCLUDED.price_tier_label, EXCLUDED.image_indices, EXCLUDED.name,
         EXCLUDED.image_url, EXCLUDED.category, EXCLUDED.supplier, EXCLUDED.is_active);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_product_fabric_swatches_for_picks(uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_swatches_from_product_fabrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ids uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(DISTINCT pick_id) INTO _ids FROM new_rows WHERE pick_id IS NOT NULL;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT array_agg(DISTINCT pick_id) INTO _ids FROM old_rows WHERE pick_id IS NOT NULL;
  ELSE
    SELECT array_agg(DISTINCT x) INTO _ids FROM (
      SELECT pick_id AS x FROM new_rows UNION SELECT pick_id FROM old_rows
    ) u WHERE x IS NOT NULL;
  END IF;
  PERFORM public.refresh_product_fabric_swatches_for_picks(_ids);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_swatches_from_fabrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ids uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NULL; -- a new library fabric has no product links yet
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.product_fabric_swatches_public s
    USING old_rows o WHERE s.fabric_id = o.id;
    RETURN NULL;
  END IF;
  SELECT array_agg(DISTINCT pf.pick_id) INTO _ids
  FROM public.product_fabrics pf
  JOIN new_rows n ON n.id = pf.fabric_id
  WHERE pf.pick_id IS NOT NULL;
  PERFORM public.refresh_product_fabric_swatches_for_picks(_ids);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS refresh_product_fabric_swatches_public_from_links ON public.product_fabrics;
DROP TRIGGER IF EXISTS refresh_product_fabric_swatches_public_from_fabrics ON public.fabrics;

CREATE TRIGGER swatches_sync_pf_ins AFTER INSERT ON public.product_fabrics
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.sync_swatches_from_product_fabrics();
CREATE TRIGGER swatches_sync_pf_upd AFTER UPDATE ON public.product_fabrics
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.sync_swatches_from_product_fabrics();
CREATE TRIGGER swatches_sync_pf_del AFTER DELETE ON public.product_fabrics
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.sync_swatches_from_product_fabrics();
CREATE TRIGGER swatches_sync_pf_trunc AFTER TRUNCATE ON public.product_fabrics
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_product_fabric_swatches_public();

CREATE TRIGGER swatches_sync_fab_upd AFTER UPDATE ON public.fabrics
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.sync_swatches_from_fabrics();
CREATE TRIGGER swatches_sync_fab_del AFTER DELETE ON public.fabrics
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.sync_swatches_from_fabrics();
CREATE TRIGGER swatches_sync_fab_trunc AFTER TRUNCATE ON public.fabrics
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_product_fabric_swatches_public();
