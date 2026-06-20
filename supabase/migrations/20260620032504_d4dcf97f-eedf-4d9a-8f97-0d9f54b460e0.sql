
-- 1) Strip heavy embedding fields from audit JSONB payload
CREATE OR REPLACE FUNCTION public.log_curator_picks_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _old jsonb;
  _new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _old := to_jsonb(OLD) - 'embedding' - 'embedding_source_hash' - 'embedded_at';
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data)
    VALUES ('designer_curator_picks', 'DELETE', OLD.id, auth.uid(), _old);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD) - 'embedding' - 'embedding_source_hash' - 'embedded_at';
    _new := to_jsonb(NEW) - 'embedding' - 'embedding_source_hash' - 'embedded_at';
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data, new_data)
    VALUES ('designer_curator_picks', 'UPDATE', NEW.id, auth.uid(), _old, _new);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    _new := to_jsonb(NEW) - 'embedding' - 'embedding_source_hash' - 'embedded_at';
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, new_data)
    VALUES ('designer_curator_picks', 'INSERT', NEW.id, auth.uid(), _new);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- 2) Scope mirror triggers to only fire when mirrored columns change
DROP TRIGGER IF EXISTS trg_sync_curator_pick_to_trade_product ON public.designer_curator_picks;
CREATE TRIGGER trg_sync_curator_pick_to_trade_product
AFTER INSERT OR UPDATE OF
  title, subtitle, designer_id, category, subcategory, materials, dimensions,
  description, pdf_url, pdf_urls, currency, lead_time, price_prefix,
  gallery_images, origin, size_variants, variant_placeholder, base_axis_label,
  top_axis_label, variant_image_map, is_hidden, trade_price_cents,
  price_per_sqm_cents, pack_cbm, pack_weight_kg, pack_carton_count,
  default_ship_mode, pickup_country, pickup_postcode, pickup_address,
  hs_code, is_upholstered, wood_label_override, image_url, hover_image_url
ON public.designer_curator_picks
FOR EACH ROW EXECUTE FUNCTION public.sync_curator_pick_to_trade_product();

DROP TRIGGER IF EXISTS trg_sync_designer_curator_picks_public ON public.designer_curator_picks;
CREATE TRIGGER trg_sync_designer_curator_picks_public
AFTER INSERT OR DELETE OR UPDATE OF
  title, subtitle, designer_id, category, subcategory, tags, materials, dimensions,
  description, edition, photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order,
  currency, lead_time, price_prefix, gallery_images, origin, size_variants,
  variant_placeholder, base_axis_label, top_axis_label, variant_image_map,
  is_hidden, edition_number, edition_signing, pack_cbm, pack_weight_kg,
  pack_carton_count, default_ship_mode, pickup_country, pickup_postcode,
  pickup_address, materials_description, gallery_captions, is_upholstered,
  wood_label_override, image_url, hover_image_url
ON public.designer_curator_picks
FOR EACH ROW EXECUTE FUNCTION public.sync_designer_curator_picks_public();
