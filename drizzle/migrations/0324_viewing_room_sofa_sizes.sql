ALTER FUNCTION public._viewing_room_editorial_product(jsonb,uuid,text,text) RENAME TO _viewing_room_editorial_product_without_sizes;
CREATE FUNCTION public._viewing_room_editorial_product(_item jsonb,_product uuid,_currency text,_variant text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.trade_products; result jsonb; variants jsonb; sizes jsonb; options jsonb; all_sizes text;
BEGIN
 SELECT * INTO t FROM public.trade_products WHERE id=_product AND is_active AND NOT coalesce(is_hidden,false);
 variants:=CASE WHEN jsonb_typeof(t.size_variants)='array' THEN t.size_variants ELSE '[]'::jsonb END;
 IF coalesce(t.product_name,'') !~* 'sofa|settee' THEN RETURN public._viewing_room_editorial_product_without_sizes(_item,_product,_currency,_variant); END IF;
 SELECT string_agg(concat_ws(' ',v->>'label',v->>'base'),' ') INTO all_sizes FROM jsonb_array_elements(variants) v;
 result:=public._viewing_room_editorial_product_without_sizes(_item,_product,_currency,all_sizes);
 SELECT coalesce(jsonb_agg(f || jsonb_build_object('size_key',s.size,'dimensions',s.size,'label',CASE WHEN v.value->>'base'=s.size THEN v.value->>'top' ELSE concat_ws(' / ',nullif(v.value->>'top',''),nullif(v.value->>'base','')) END) ORDER BY (f->>'key')::integer),'[]'::jsonb) INTO options FROM jsonb_array_elements(result->'finish_options') f JOIN jsonb_array_elements(variants) WITH ORDINALITY v ON v.ordinality::text=f->>'key' CROSS JOIN LATERAL (SELECT CASE WHEN v.value->>'base' ~* '[0-9]+.*(cm|mm)' THEN v.value->>'base' WHEN v.value->>'label' ~* '[0-9]+.*(cm|mm)' THEN v.value->>'label' END AS size) s WHERE s.size IS NOT NULL;
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',size,'label',size) ORDER BY first_key),'[]'::jsonb) INTO sizes FROM (SELECT f->>'size_key' AS size,min((f->>'key')::integer) AS first_key FROM jsonb_array_elements(options) f GROUP BY f->>'size_key') x;
 IF jsonb_array_length(sizes)=0 THEN RETURN public._viewing_room_editorial_product_without_sizes(_item,_product,_currency,_variant); END IF;
 RETURN result || jsonb_build_object('finish_options',options,'size_options',sizes);
END $$;
REVOKE ALL ON FUNCTION public._viewing_room_editorial_product(jsonb,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._viewing_room_editorial_product(jsonb,uuid,text,text) TO service_role;
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
 IF finish->>'size_key' IS DISTINCT FROM choice->>'size_key' THEN RAISE EXCEPTION 'Unapproved size'; END IF;
 selected:=selected || finish || jsonb_build_object('finish_key',finish->>'key','retail_price_from',false);
 ELSIF choice->>'size_key' IS NOT NULL THEN RAISE EXCEPTION 'Choose size finish';
 END IF;
 total:=total+coalesce((selected->>'retail_price')::numeric-(slot->>'retail_price')::numeric,0);
 lines:=lines||jsonb_build_array((selected-'alternatives'-'finish_options'-'size_options')||jsonb_build_object('slot_id',slot->>'id'));
 END LOOP;
 result:=jsonb_build_object('package',p.tier_name,'currency',p.currency,'total',total,'items',lines,'status','requested');
 INSERT INTO public.viewing_room_proposal_requests(package_id,request_key,snapshot) VALUES(p.id,_request_key,result) ON CONFLICT(request_key) DO NOTHING RETURNING id INTO request_id;
 IF request_id IS NULL THEN SELECT snapshot INTO result FROM public.viewing_room_proposal_requests WHERE request_key=_request_key AND package_id=p.id; IF result IS NULL THEN RAISE EXCEPTION 'Request unavailable'; END IF; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.lock_viewing_room_proposal(text,uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_viewing_room_proposal(text,uuid,jsonb,uuid) TO anon,authenticated,service_role;