CREATE FUNCTION public._viewing_room_editorial_product(_item jsonb, _product uuid, _currency text, _variant text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.trade_products; rate numeric; retail jsonb; options jsonb; variants jsonb;
BEGIN
 SELECT * INTO t FROM public.trade_products WHERE id=_product AND is_active AND NOT coalesce(is_hidden,false);
 IF t.id IS NULL THEN RETURN _item || jsonb_build_object('finish_options','[]'::jsonb); END IF;
 rate:=CASE WHEN coalesce(t.currency,'EUR')=_currency THEN 1 ELSE (SELECT r.rate FROM public.currency_rates r WHERE r.base_currency=coalesce(t.currency,'EUR') AND r.target_currency=_currency ORDER BY r.rate_date DESC LIMIT 1) END;
 retail:=public._shared_board_retail_price(t.rrp_price_cents,t.size_variants,_variant);
 variants:=CASE WHEN jsonb_typeof(t.size_variants)='array' THEN t.size_variants ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',v.ordinality::text,'label',concat_ws(' / ',nullif(v.value->>'top',''),nullif(v.value->>'base','')),'retail_price',round((v.value->>'price_cents')::numeric*rate)/100,'image_url',_item->'image_url','lead_time',coalesce(v.value->>'lead_time',t.lead_time),'materials',coalesce((SELECT jsonb_object_agg(axis.role,jsonb_build_object('id',f.id,'name',f.name,'category',f.category,'brand_name',f.supplier,'image_url',f.image_url,'material_type',f.material_type,'color_family',f.color_family)) FROM (VALUES ('top',v.value->>'top'),('base',v.value->>'base')) axis(role,name) JOIN LATERAL (SELECT * FROM public.fabrics f WHERE f.is_active AND lower(f.supplier)=lower(t.brand_name) AND lower(f.name)=lower(axis.name) AND f.image_url IS NOT NULL ORDER BY f.id LIMIT 1) f ON true),'{}'::jsonb)) ORDER BY v.ordinality),'[]'::jsonb) INTO options FROM jsonb_array_elements(variants) WITH ORDINALITY v
 WHERE rate>0 AND v.value->>'price_cents' ~ '^[0-9]+$' AND (v.value->>'price_cents')::numeric>0 AND (v.value ? 'top' OR v.value ? 'base')
 AND (coalesce(v.value->>'label','')='' OR _variant LIKE '%'||(v.value->>'label')||'%' OR (SELECT count(DISTINCT x->>'label') FROM jsonb_array_elements(variants) x)=1)
 AND (coalesce(v.value->>'base','') !~* '[0-9]+.*(cm|mm)' OR _variant LIKE '%'||(v.value->>'base')||'%');
 RETURN _item || jsonb_build_object('retail_price',CASE WHEN rate>0 THEN round((retail->>'cents')::numeric*rate)/100 ELSE NULL END,'retail_price_from',coalesce((retail->>'from')::boolean,false),'finish_options',options);
END $$;
REVOKE ALL ON FUNCTION public._viewing_room_editorial_product(jsonb,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._viewing_room_editorial_product(jsonb,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.get_viewing_room_personalization(_token text,_package_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE data jsonb; items jsonb; p public.furniture_packages;
BEGIN
 data:=public.get_viewing_room_choices(_token,_package_id); IF data IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO p FROM public.furniture_packages WHERE id=_package_id;
 SELECT coalesce(jsonb_agg(public._viewing_room_editorial_product(j,i.product_id,p.currency,i.variant_label) || jsonb_build_object('is_swappable',r.id IS NOT NULL AND coalesce(r.is_swappable,false) AND p.allow_alternatives,'allow_finish_customization',r.id IS NOT NULL AND coalesce(r.allow_finish_customization,false),'alternatives',CASE WHEN r.id IS NOT NULL AND r.is_swappable AND p.allow_alternatives THEN coalesce((SELECT jsonb_agg(public._viewing_room_editorial_product(a,(a->>'id')::uuid,p.currency,NULL)) FROM jsonb_array_elements(j->'alternatives') a),'[]'::jsonb) ELSE '[]'::jsonb END)),'[]'::jsonb) INTO items FROM jsonb_array_elements(data->'items') j JOIN public.client_board_items i ON i.id=(j->>'id')::uuid LEFT JOIN public.hotspot_slot_rules r ON r.furniture_package_id=p.id AND r.board_item_id=i.id;
 RETURN jsonb_build_object('items',items,'allow_alternatives',p.allow_alternatives);
END $$;
REVOKE ALL ON FUNCTION public.get_viewing_room_personalization(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viewing_room_personalization(text,uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.lock_viewing_room_proposal(_token text,_package_id uuid,_choices jsonb,_request_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE data jsonb; p public.furniture_packages; slot jsonb; choice jsonb; selected jsonb; finish jsonb; lines jsonb:='[]'; total numeric; result jsonb; request_id uuid;
BEGIN
 data:=public.get_viewing_room_personalization(_token,_package_id); IF data IS NULL THEN RAISE EXCEPTION 'Viewing room unavailable'; END IF;
 SELECT * INTO p FROM public.furniture_packages WHERE id=_package_id;
 IF jsonb_typeof(_choices) IS DISTINCT FROM 'array' OR jsonb_array_length(_choices)<>jsonb_array_length(data->'items') THEN RAISE EXCEPTION 'Choose every slot'; END IF;
 SELECT snapshot INTO result FROM public.viewing_room_proposal_requests WHERE request_key=_request_key AND package_id=p.id; IF result IS NOT NULL THEN RETURN result; END IF;
 total:=p.package_price;
 FOR slot IN SELECT value FROM jsonb_array_elements(data->'items') LOOP
 IF (SELECT count(*) FROM jsonb_array_elements(_choices) c WHERE c->>'slot_id'=slot->>'id')<>1 THEN RAISE EXCEPTION 'Invalid slot'; END IF;
 SELECT c INTO choice FROM jsonb_array_elements(_choices) c WHERE c->>'slot_id'=slot->>'id'; selected:=slot;
 IF choice->>'product_id' IS DISTINCT FROM slot->>'id' THEN
 IF NOT (slot->>'is_swappable')::boolean THEN RAISE EXCEPTION 'Selection fixed'; END IF;
 SELECT a INTO selected FROM jsonb_array_elements(slot->'alternatives') a WHERE a->>'id'=choice->>'product_id';
 IF selected IS NULL OR selected->>'retail_price' IS NULL OR slot->>'retail_price' IS NULL THEN RAISE EXCEPTION 'Unapproved choice'; END IF;
 END IF;
 IF choice->>'finish_key' IS NOT NULL THEN
 IF NOT (slot->>'allow_finish_customization')::boolean THEN RAISE EXCEPTION 'Finish fixed'; END IF;
 SELECT f INTO finish FROM jsonb_array_elements(selected->'finish_options') f WHERE f->>'key'=choice->>'finish_key';
 IF finish IS NULL OR slot->>'retail_price' IS NULL THEN RAISE EXCEPTION 'Unapproved finish'; END IF;
 selected:=selected || finish || jsonb_build_object('finish_key',finish->>'key','retail_price_from',false);
 END IF;
 total:=total+coalesce((selected->>'retail_price')::numeric-(slot->>'retail_price')::numeric,0);
 lines:=lines||jsonb_build_array((selected-'alternatives'-'finish_options')||jsonb_build_object('slot_id',slot->>'id'));
 END LOOP;
 result:=jsonb_build_object('package',p.tier_name,'currency',p.currency,'total',total,'items',lines,'status','requested');
 INSERT INTO public.viewing_room_proposal_requests(package_id,request_key,snapshot) VALUES(p.id,_request_key,result) ON CONFLICT(request_key) DO NOTHING RETURNING id INTO request_id;
 IF request_id IS NULL THEN SELECT snapshot INTO result FROM public.viewing_room_proposal_requests WHERE request_key=_request_key AND package_id=p.id; IF result IS NULL THEN RAISE EXCEPTION 'Request unavailable'; END IF; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.lock_viewing_room_proposal(text,uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_viewing_room_proposal(text,uuid,jsonb,uuid) TO anon,authenticated,service_role;