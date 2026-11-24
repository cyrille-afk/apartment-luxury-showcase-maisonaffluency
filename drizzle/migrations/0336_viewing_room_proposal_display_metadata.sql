CREATE OR REPLACE FUNCTION public._viewing_room_proposal_metadata(_item jsonb, _product uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb:=_item; maker text; resolved jsonb;
BEGIN
 SELECT brand_name INTO maker FROM public.trade_products WHERE id=_product;
 SELECT coalesce(jsonb_object_agg(m.key, CASE WHEN btrim(coalesce(m.value->>'name','')) ~ '^\d+$' THEN m.value || jsonb_build_object('name',coalesce(f.name,'Selected '||coalesce(nullif(m.value->>'category',''),'material')||' — name to be confirmed')) ELSE m.value END),'{}'::jsonb) INTO resolved FROM jsonb_each(coalesce(_item->'materials','{}'::jsonb)) m LEFT JOIN public.fabrics f ON f.id::text=m.value->>'id' WHERE m.key NOT LIKE 'default-%';
 RETURN result || jsonb_build_object('brand_name',maker,'materials',resolved);
END $$;
REVOKE ALL ON FUNCTION public._viewing_room_proposal_metadata(jsonb,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_viewing_room_personalization(_token text, _package_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE data jsonb; items jsonb; p public.furniture_packages;
BEGIN
 data:=public.get_viewing_room_choices(_token,_package_id); IF data IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO p FROM public.furniture_packages WHERE id=_package_id;
 SELECT coalesce(jsonb_agg(public._viewing_room_proposal_metadata(public._viewing_room_editorial_product(j,i.product_id,p.currency,i.variant_label),i.product_id) || jsonb_build_object('is_swappable',r.id IS NOT NULL AND coalesce(r.is_swappable,false) AND p.allow_alternatives,'allow_finish_customization',r.id IS NOT NULL AND coalesce(r.allow_finish_customization,false),'alternatives',coalesce((SELECT jsonb_agg(public._viewing_room_proposal_metadata(a,(a->>'id')::uuid)) FROM jsonb_array_elements(public._viewing_room_footprint_alternatives(p.id,i.id)) a),'[]'::jsonb)) ORDER BY i.sort_order,i.id),'[]'::jsonb) INTO items FROM jsonb_array_elements(data->'items') j JOIN public.client_board_items i ON i.id=(j->>'id')::uuid LEFT JOIN public.hotspot_slot_rules r ON r.furniture_package_id=p.id AND r.board_item_id=i.id;
 RETURN jsonb_build_object('items',items,'allow_alternatives',p.allow_alternatives);
END $$;
REVOKE ALL ON FUNCTION public.get_viewing_room_personalization(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viewing_room_personalization(text,uuid) TO anon,authenticated,service_role;