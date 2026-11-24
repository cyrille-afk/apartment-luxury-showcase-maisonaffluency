ALTER FUNCTION public._viewing_room_editorial_product(jsonb,uuid,text,text) RENAME TO _viewing_room_editorial_product_without_axes;
CREATE FUNCTION public._viewing_room_editorial_product(_item jsonb,_product uuid,_currency text,_variant text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; options jsonb; t record;
BEGIN
 result:=public._viewing_room_editorial_product_without_axes(_item,_product,_currency,_variant);
 IF jsonb_typeof(result->'finish_options') IS DISTINCT FROM 'array' THEN RETURN result; END IF;
 SELECT brand_name, base_axis_label, top_axis_label, size_variants::jsonb AS variants INTO t FROM public.trade_products WHERE id=_product;
 IF t IS NULL OR coalesce(t.base_axis_label,'') !~* 'upholst|fabric|leather|seat' OR coalesce(t.top_axis_label,'') !~* 'upholst|fabric|leather|back' OR jsonb_typeof(t.variants) IS DISTINCT FROM 'array' THEN RETURN result; END IF;
 SELECT coalesce(jsonb_agg(CASE WHEN v IS NULL THEN o ELSE o || jsonb_build_object('label',concat_ws(' / ',nullif(v->>'base',''),nullif(v->>'top',''),nullif(frame,'')),'axes',ax.axes,'materials',coalesce(o->'materials','{}'::jsonb)-'top' || jsonb_strip_nulls(jsonb_build_object('upholstery',ax.axes->0->'colours'->0,'backrest',ax.axes->1->'colours'->0,'base',ax.axes->2->'colours'->0))) END ORDER BY ord),'[]'::jsonb) INTO options
 FROM jsonb_array_elements(result->'finish_options') WITH ORDINALITY x(o,ord)
 CROSS JOIN LATERAL (SELECT t.variants->(((o->>'key')::int)-1) AS v) vv
 CROSS JOIN LATERAL (SELECT CASE WHEN coalesce(v->>'label','') ~* '[0-9]+.*(cm|mm)' THEN NULL ELSE nullif(v->>'label','') END AS frame) fr
 CROSS JOIN LATERAL (SELECT jsonb_build_array(
   jsonb_build_object('role','seat','label',t.base_axis_label,'value',v->>'base','colours',public._viewing_room_axis_colours(t.brand_name,v->>'base',true)),
   jsonb_build_object('role','backrest','label',t.top_axis_label,'value',v->>'top','colours',public._viewing_room_axis_colours(t.brand_name,v->>'top',true)),
   jsonb_build_object('role','frame','label','Frame Finish','value',frame,'colours',public._viewing_room_axis_colours(t.brand_name,frame,false))) AS axes) ax;
 RETURN result || jsonb_build_object('finish_options',options);
END $$;

CREATE FUNCTION public._viewing_room_axis_colours(_brand text,_value text,_textile boolean) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'category',f.category,'brand_name',f.supplier,'image_url',f.image_url,'material_type',NULL,'color_family',NULL) ORDER BY f.name),'[]'::jsonb)
 FROM (SELECT f.* FROM public.fabrics f, (SELECT btrim(regexp_replace(coalesce(_value,''),'\s*(leather\s+)?range\s*$','','i')) AS fam) q
  WHERE length(q.fam)>=3 AND upper(q.fam)<>'COM' AND f.is_active AND f.image_url IS NOT NULL AND lower(f.supplier)=lower(_brand)
   AND CASE WHEN _textile THEN f.category ~* 'fabric|leather|upholster' AND lower(f.name) LIKE lower(q.fam)||'%' ELSE f.category !~* 'fabric|leather|upholster' AND lower(f.name) LIKE '%'||lower(q.fam)||'%' END
  ORDER BY f.name LIMIT 24) f
$$;
REVOKE ALL ON FUNCTION public._viewing_room_axis_colours(text,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._viewing_room_editorial_product_without_axes(jsonb,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._viewing_room_editorial_product(jsonb,uuid,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.lock_viewing_room_proposal(_token text, _package_id uuid, _choices jsonb, _request_key uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE data jsonb; p public.furniture_packages; slot jsonb; choice jsonb; selected jsonb; finish jsonb; colourway jsonb; axis_pick record; axis jsonb; lines jsonb:='[]'; total numeric; result jsonb; request_id uuid;
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
 IF choice->>'colourway_id' IS NOT NULL THEN
 SELECT w INTO colourway FROM jsonb_array_elements(coalesce(finish->'colourways','[]'::jsonb)) w WHERE w->>'id'=choice->>'colourway_id';
 IF colourway IS NULL THEN RAISE EXCEPTION 'Unapproved colourway'; END IF;
 finish:=finish || jsonb_build_object('materials',coalesce(finish->'materials','{}'::jsonb) || jsonb_build_object('upholstery',colourway));
 END IF;
 IF jsonb_typeof(choice->'axis_colours')='object' THEN
 FOR axis_pick IN SELECT key, value FROM jsonb_each_text(choice->'axis_colours') LOOP
  SELECT w INTO colourway FROM jsonb_array_elements(coalesce(finish->'axes','[]'::jsonb)) a, jsonb_array_elements(a->'colours') w WHERE a->>'role'=axis_pick.key AND w->>'id'=axis_pick.value;
  IF colourway IS NULL THEN RAISE EXCEPTION 'Unapproved colourway'; END IF;
  finish:=finish || jsonb_build_object('materials',coalesce(finish->'materials','{}'::jsonb) || jsonb_build_object(CASE axis_pick.key WHEN 'seat' THEN 'upholstery' WHEN 'frame' THEN 'base' ELSE 'backrest' END,colourway));
 END LOOP;
 END IF;
 selected:=selected || (finish-'colourways'-'axes') || jsonb_build_object('finish_key',finish->>'key','retail_price_from',false);
 ELSIF choice->>'size_key' IS NOT NULL OR choice->>'colourway_id' IS NOT NULL OR choice ? 'axis_colours' THEN RAISE EXCEPTION 'Choose size finish';
 END IF;
 total:=total+coalesce((selected->>'retail_price')::numeric-(slot->>'retail_price')::numeric,0);
 lines:=lines||jsonb_build_array((selected-'alternatives'-'finish_options'-'size_options')||jsonb_build_object('slot_id',slot->>'id'));
 END LOOP;
 result:=jsonb_build_object('package',p.tier_name,'currency',p.currency,'total',total,'items',lines,'status','requested');
 INSERT INTO public.viewing_room_proposal_requests(package_id,request_key,snapshot) VALUES(p.id,_request_key,result) ON CONFLICT(request_key) DO NOTHING RETURNING id INTO request_id;
 IF request_id IS NULL THEN SELECT snapshot INTO result FROM public.viewing_room_proposal_requests WHERE request_key=_request_key AND package_id=p.id; IF result IS NULL THEN RAISE EXCEPTION 'Request unavailable'; END IF; END IF;
 RETURN result;
END $function$;

UPDATE public.trade_product_glb_variants SET material_roles = material_roles || '{"01 - Default":"backrest"}'::jsonb WHERE product_id='f72b4185-9eeb-4ec0-b862-0972abc93a9f';