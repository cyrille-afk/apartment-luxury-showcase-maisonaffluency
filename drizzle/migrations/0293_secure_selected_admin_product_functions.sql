CREATE OR REPLACE FUNCTION public.commit_admin_price_save(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 _attempt public.admin_price_save_attempts;
 _current jsonb;
 _new public.designer_curator_picks;
 _count integer;
 _code text;
BEGIN
 IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO _attempt FROM public.admin_price_save_attempts WHERE id=_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Save attempt unavailable'; END IF;
 IF _attempt.status <> 'Saving' THEN RETURN jsonb_build_object('status',_attempt.status,'error_code',_attempt.error_code); END IF;
 BEGIN
  IF _attempt.field_name IS NULL OR _attempt.field_name NOT IN ('trade_price_cents','price_per_sqm_cents','size_variants','currency','price_prefix') THEN
   RAISE EXCEPTION 'Unsupported price field' USING ERRCODE='22023';
  END IF;
  SELECT to_jsonb(p) INTO _current FROM public.designer_curator_picks p WHERE id=_attempt.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable' USING ERRCODE='P0002'; END IF;
  IF (_current -> _attempt.field_name) IS DISTINCT FROM (_attempt.old_data -> _attempt.field_name) THEN
   RAISE EXCEPTION 'Price changed since save started' USING ERRCODE='40001';
  END IF;
  SELECT * INTO _new FROM jsonb_populate_record(NULL::public.designer_curator_picks,
   jsonb_build_object(_attempt.field_name, _attempt.new_data -> _attempt.field_name));
  CASE _attempt.field_name
   WHEN 'trade_price_cents' THEN UPDATE public.designer_curator_picks SET trade_price_cents=_new.trade_price_cents WHERE id=_attempt.product_id;
   WHEN 'price_per_sqm_cents' THEN UPDATE public.designer_curator_picks SET price_per_sqm_cents=_new.price_per_sqm_cents WHERE id=_attempt.product_id;
   WHEN 'size_variants' THEN UPDATE public.designer_curator_picks SET size_variants=_new.size_variants WHERE id=_attempt.product_id;
   WHEN 'currency' THEN UPDATE public.designer_curator_picks SET currency=_new.currency WHERE id=_attempt.product_id;
   WHEN 'price_prefix' THEN UPDATE public.designer_curator_picks SET price_prefix=_new.price_prefix WHERE id=_attempt.product_id;
  END CASE;
  GET DIAGNOSTICS _count = ROW_COUNT;
  IF _count <> 1 THEN RAISE EXCEPTION 'Save unconfirmed'; END IF;
  UPDATE public.admin_price_save_attempts SET status='Saved',completed_at=now() WHERE id=_id;
  RETURN jsonb_build_object('status','Saved');
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS _code = RETURNED_SQLSTATE;
  UPDATE public.admin_price_save_attempts SET status='Failed',error_code=_code,completed_at=now() WHERE id=_id;
  RETURN jsonb_build_object('status','Failed','error_code',_code);
 END;
END $$;
REVOKE ALL ON FUNCTION public.commit_admin_price_save(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_admin_price_save(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.restore_curator_pick_version(_audit_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _snap jsonb; _id uuid;
BEGIN
 IF auth.uid() IS NULL OR (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
 END IF;
 SELECT CASE WHEN operation='DELETE' THEN coalesce(old_data,new_data)::jsonb ELSE coalesce(new_data,old_data)::jsonb END
 INTO _snap FROM public.content_audit_log WHERE id=_audit_id AND table_name='designer_curator_picks';
 IF _snap IS NULL THEN RAISE EXCEPTION 'Version not found'; END IF;
 _id := (_snap->>'id')::uuid;
 IF _id IS NULL THEN RAISE EXCEPTION 'Invalid version'; END IF;
 PERFORM 1 FROM public.designer_curator_picks WHERE id=_id FOR UPDATE;
 IF FOUND THEN
  -- Fixed columns only; absent historical fields retain their current values.
  -- Identity and creation time are never overwritten on an existing product.
  UPDATE public.designer_curator_picks t SET
   (designer_id, image_url, hover_image_url, title, subtitle, category, subcategory, tags, materials, dimensions, description, edition, photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order, trade_price_cents, currency, lead_time, price_prefix, gallery_images, origin, size_variants, variant_placeholder, base_axis_label, top_axis_label, variant_image_map, is_hidden, edition_number, edition_signing, price_per_sqm_cents, pack_cbm, pack_weight_kg, pack_carton_count, default_ship_mode, pickup_country, pickup_postcode, pickup_address, embedding, embedding_source_hash, embedded_at, materials_description, hs_code, gallery_captions, is_upholstered, com_meters, fabric_size_label_a, fabric_size_label_b, wood_label_override, allow_com_col, width_mm, depth_mm, height_mm, seat_height_mm, is_contract_grade, meta_description, slug, style_tags, crate_specs, hs_code_rules, hs6_code, duty_rate, is_allocation_restricted, allocation_unit_cap, available_stock_units, weight_kg, crated_width_mm, crated_depth_mm, crated_height_mm, requires_white_glove, trade_only, default_variant_label, hidden_in_studio) =
   (SELECT r.designer_id, r.image_url, r.hover_image_url, r.title, r.subtitle, r.category, r.subcategory, r.tags, r.materials, r.dimensions, r.description, r.edition, r.photo_credit, r.pdf_url, r.pdf_filename, r.pdf_urls, r.sort_order, r.trade_price_cents, r.currency, r.lead_time, r.price_prefix, r.gallery_images, r.origin, r.size_variants, r.variant_placeholder, r.base_axis_label, r.top_axis_label, r.variant_image_map, r.is_hidden, r.edition_number, r.edition_signing, r.price_per_sqm_cents, r.pack_cbm, r.pack_weight_kg, r.pack_carton_count, r.default_ship_mode, r.pickup_country, r.pickup_postcode, r.pickup_address, r.embedding, r.embedding_source_hash, r.embedded_at, r.materials_description, r.hs_code, r.gallery_captions, r.is_upholstered, r.com_meters, r.fabric_size_label_a, r.fabric_size_label_b, r.wood_label_override, r.allow_com_col, r.width_mm, r.depth_mm, r.height_mm, r.seat_height_mm, r.is_contract_grade, r.meta_description, r.slug, r.style_tags, r.crate_specs, r.hs_code_rules, r.hs6_code, r.duty_rate, r.is_allocation_restricted, r.allocation_unit_cap, r.available_stock_units, r.weight_kg, r.crated_width_mm, r.crated_depth_mm, r.crated_height_mm, r.requires_white_glove, r.trade_only, r.default_variant_label, r.hidden_in_studio
    FROM jsonb_populate_record(NULL::public.designer_curator_picks, to_jsonb(t) || (_snap - 'id' - 'created_at')) r)
  WHERE t.id=_id;
 ELSE
  INSERT INTO public.designer_curator_picks
   SELECT (jsonb_populate_record(NULL::public.designer_curator_picks, _snap)).*;
 END IF;
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.restore_curator_pick_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_curator_pick_version(uuid) TO authenticated, service_role;
