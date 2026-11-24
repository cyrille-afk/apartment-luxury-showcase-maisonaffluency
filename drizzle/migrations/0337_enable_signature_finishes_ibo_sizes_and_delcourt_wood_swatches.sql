CREATE OR REPLACE FUNCTION public._viewing_room_editorial_product_without_sizes(_item jsonb, _product uuid, _currency text, _variant text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t public.trade_products; rate numeric; retail jsonb; options jsonb; variants jsonb;
BEGIN
 SELECT * INTO t FROM public.trade_products WHERE id=_product AND is_active AND NOT coalesce(is_hidden,false);
 IF t.id IS NULL THEN RETURN _item || jsonb_build_object('finish_options','[]'::jsonb); END IF;
 rate:=CASE WHEN coalesce(t.currency,'EUR')=_currency THEN 1 ELSE (SELECT r.rate FROM public.currency_rates r WHERE r.base_currency=coalesce(t.currency,'EUR') AND r.target_currency=_currency ORDER BY r.rate_date DESC LIMIT 1) END;
 retail:=public._shared_board_retail_price(t.rrp_price_cents,t.size_variants,_variant);
 variants:=CASE WHEN jsonb_typeof(t.size_variants)='array' THEN t.size_variants ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'key',v.ordinality::text,
   'label',concat_ws(' / ',nullif(v.value->>'top',''),nullif(v.value->>'base','')),
   'retail_price',round((v.value->>'price_cents')::numeric*rate)/100,
   'image_url',_item->'image_url',
   'lead_time',coalesce(v.value->>'lead_time',t.lead_time),
   'materials',CASE
     WHEN (mat.m ? 'top') AND NOT (mat.m ? 'base') AND coalesce(btrim(v.value->>'base'),'')='' AND coalesce(mat.m->'top'->>'category','') !~* 'fabric|leather|upholster'
       THEN mat.m || jsonb_build_object('base',mat.m->'top')
     WHEN (mat.m ? 'base') AND NOT (mat.m ? 'top') AND coalesce(btrim(v.value->>'top'),'')='' AND coalesce(mat.m->'base'->>'category','') !~* 'fabric|leather|upholster'
       THEN mat.m || jsonb_build_object('top',mat.m->'base')
     ELSE mat.m
   END
 ) ORDER BY v.ordinality),'[]'::jsonb) INTO options
 FROM jsonb_array_elements(variants) WITH ORDINALITY v
 CROSS JOIN LATERAL (
   SELECT coalesce(jsonb_object_agg(
     CASE WHEN axis.role='top' AND f.category ~* 'fabric|leather|upholster' THEN 'upholstery' ELSE axis.role END,
     jsonb_build_object('id',f.id,'name',f.name,'category',f.category,'brand_name',f.supplier,'image_url',f.image_url,'material_type',NULL,'color_family',NULL)
   ),'{}'::jsonb) AS m
   FROM (VALUES ('top',v.value->>'top'),('base',v.value->>'base')) axis(role,name)
   JOIN LATERAL (
     SELECT f.* FROM public.fabrics f
     LEFT JOIN public.product_fabric_swatches_public s
       ON s.pick_id=t.source_pick_id AND s.fabric_id=f.id AND s.is_active
     WHERE btrim(coalesce(axis.name,''))<>''
       AND f.is_active AND f.image_url IS NOT NULL
       AND lower(f.supplier)=lower(t.brand_name)
       AND (
         lower(f.name)=lower(btrim(axis.name))
         OR (
           f.category !~* 'fabric|leather|upholster'
           AND (lower(f.name) LIKE lower(btrim(axis.name))||'-%' OR lower(f.name) LIKE lower(btrim(axis.name))||' %')
         )
       )
     ORDER BY (s.fabric_id IS NOT NULL) DESC, coalesce(s.sort_order,9999), (lower(f.name)=lower(btrim(axis.name))) DESC, f.name, f.id
     LIMIT 1
   ) f ON true
 ) mat
 WHERE rate>0 AND v.value->>'price_cents' ~ '^[0-9]+$' AND (v.value->>'price_cents')::numeric>0 AND (v.value ? 'top' OR v.value ? 'base')
 AND (coalesce(v.value->>'label','')='' OR _variant LIKE '%'||(v.value->>'label')||'%' OR (SELECT count(DISTINCT x->>'label') FROM jsonb_array_elements(variants) x)=1)
 AND (coalesce(v.value->>'base','') !~* '[0-9]+.*(cm|mm)' OR _variant LIKE '%'||(v.value->>'base')||'%');
 RETURN _item || jsonb_build_object('retail_price',CASE WHEN rate>0 THEN round((retail->>'cents')::numeric*rate)/100 ELSE NULL END,'retail_price_from',coalesce((retail->>'from')::boolean,false),'finish_options',options);
END $function$;

CREATE OR REPLACE FUNCTION public._viewing_room_editorial_product_without_colourways(_item jsonb, _product uuid, _currency text, _variant text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t public.trade_products; result jsonb; variants jsonb; sizes jsonb; options jsonb; all_sizes text; multi_size_table boolean;
BEGIN
 SELECT * INTO t FROM public.trade_products WHERE id=_product AND is_active AND NOT coalesce(is_hidden,false);
 variants:=CASE WHEN jsonb_typeof(t.size_variants)='array' THEN t.size_variants ELSE '[]'::jsonb END;
 SELECT count(DISTINCT v->>'label')>1 INTO multi_size_table
 FROM jsonb_array_elements(variants) v
 WHERE coalesce(v->>'label','') ~* '[0-9]+.*(cm|mm)' AND coalesce(btrim(v->>'top'),'')<>'' AND coalesce(btrim(v->>'base'),'')='';
 IF coalesce(t.product_name,'') !~* 'sofa|settee' AND NOT coalesce(multi_size_table,false) THEN
   RETURN public._viewing_room_editorial_product_without_sizes(_item,_product,_currency,_variant);
 END IF;
 SELECT string_agg(concat_ws(' ',v->>'label',v->>'base'),' ') INTO all_sizes FROM jsonb_array_elements(variants) v;
 result:=public._viewing_room_editorial_product_without_sizes(_item,_product,_currency,all_sizes);
 SELECT coalesce(jsonb_agg(f || jsonb_build_object('size_key',s.size,'dimensions',s.size,'label',CASE WHEN v.value->>'base'=s.size THEN v.value->>'top' ELSE concat_ws(' / ',nullif(v.value->>'top',''),nullif(v.value->>'base','')) END) ORDER BY (f->>'key')::integer),'[]'::jsonb) INTO options
 FROM jsonb_array_elements(result->'finish_options') f
 JOIN jsonb_array_elements(variants) WITH ORDINALITY v ON v.ordinality::text=f->>'key'
 CROSS JOIN LATERAL (SELECT CASE WHEN v.value->>'base' ~* '[0-9]+.*(cm|mm)' THEN v.value->>'base' WHEN v.value->>'label' ~* '[0-9]+.*(cm|mm)' THEN v.value->>'label' END AS size) s
 WHERE s.size IS NOT NULL;
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',size,'label',size) ORDER BY first_key),'[]'::jsonb) INTO sizes
 FROM (SELECT f->>'size_key' AS size,min((f->>'key')::integer) AS first_key FROM jsonb_array_elements(options) f GROUP BY f->>'size_key') x;
 IF jsonb_array_length(sizes)=0 THEN RETURN public._viewing_room_editorial_product_without_sizes(_item,_product,_currency,_variant); END IF;
 RETURN result || jsonb_build_object('finish_options',options,'size_options',sizes)
   || CASE WHEN coalesce(_item->>'dimensions','')='' AND coalesce(_variant,'') ~* '[0-9]+.*(cm|mm)' THEN jsonb_build_object('dimensions',_variant) ELSE '{}'::jsonb END;
END $function$;

CREATE OR REPLACE FUNCTION public._viewing_room_editorial_product_without_axes(_item jsonb, _product uuid, _currency text, _variant text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb; options jsonb; roles jsonb; t record;
BEGIN
 result:=public._viewing_room_editorial_product_without_colourways(_item,_product,_currency,_variant);
 SELECT v.material_roles INTO roles FROM public.trade_product_glb_variants v
  WHERE v.product_id=_product AND v.material_roles IS NOT NULL AND v.material_roles<>'{}'::jsonb
  ORDER BY (v.glb_url = result->>'glb_url') DESC, v.is_default DESC NULLS LAST LIMIT 1;
 IF roles IS NOT NULL THEN result:=result || jsonb_build_object('material_roles',roles); END IF;
 IF jsonb_typeof(result->'finish_options') IS DISTINCT FROM 'array' THEN RETURN result; END IF;
 SELECT brand_name, source_pick_id INTO t FROM public.trade_products WHERE id=_product;
 SELECT coalesce(jsonb_agg(
   CASE
     WHEN jsonb_array_length(c.list)>0 THEN o || jsonb_build_object('colourways',c.list,'materials',coalesce(o->'materials','{}'::jsonb) || CASE WHEN o->'materials' ? 'upholstery' THEN '{}'::jsonb ELSE jsonb_build_object('upholstery',c.list->0) END)
     WHEN jsonb_array_length(w.list)>0 THEN o || jsonb_build_object('colourways',w.list)
     ELSE o
   END ORDER BY ord),'[]'::jsonb) INTO options
 FROM jsonb_array_elements(result->'finish_options') WITH ORDINALITY x(o,ord)
 CROSS JOIN LATERAL (SELECT btrim((regexp_match(o->>'label','Fabric\s+Cat\.?\s*([^/·]+)','i'))[1]) AS family) fam
 CROSS JOIN LATERAL (
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'category',f.category,'brand_name',f.supplier,'image_url',f.image_url,'material_type',NULL,'color_family',NULL) ORDER BY f.name),'[]'::jsonb) AS list
   FROM (SELECT * FROM public.fabrics f WHERE fam.family IS NOT NULL AND f.is_active AND f.image_url IS NOT NULL AND f.category ~* 'fabric|leather|upholster' AND (lower(f.name)=lower(fam.family) OR lower(f.name) LIKE lower(fam.family)||' %') ORDER BY f.name LIMIT 24) f
 ) c
 CROSS JOIN LATERAL (
   WITH linked AS (
     SELECT f.id, f.name, f.category, f.supplier, f.image_url, coalesce(s.sort_order,9999) AS ord_n
     FROM public.product_fabric_swatches_public s
     JOIN public.fabrics f ON f.id=s.fabric_id
     WHERE fam.family IS NULL
       AND t.source_pick_id IS NOT NULL AND s.pick_id=t.source_pick_id AND s.is_active
       AND coalesce(o->>'label','')<>'' AND position('/' in coalesce(o->>'label',''))=0
       AND NOT (coalesce(o->'materials','{}'::jsonb) ? 'upholstery')
       AND (coalesce(o->'materials','{}'::jsonb) ? 'top' OR coalesce(o->'materials','{}'::jsonb) ? 'base')
       AND f.is_active AND f.image_url IS NOT NULL AND f.category !~* 'fabric|leather|upholster'
       AND (lower(f.name)=lower(btrim(o->>'label')) OR lower(f.name) LIKE lower(btrim(o->>'label'))||'-%' OR lower(f.name) LIKE lower(btrim(o->>'label'))||' %')
     ORDER BY s.sort_order NULLS LAST, f.name LIMIT 24
   ),
   fallback AS (
     SELECT f.id, f.name, f.category, f.supplier, f.image_url, 9999 AS ord_n
     FROM public.fabrics f
     WHERE NOT EXISTS (SELECT 1 FROM linked)
       AND fam.family IS NULL AND t.brand_name IS NOT NULL
       AND coalesce(o->>'label','')<>'' AND position('/' in coalesce(o->>'label',''))=0
       AND NOT (coalesce(o->'materials','{}'::jsonb) ? 'upholstery')
       AND (coalesce(o->'materials','{}'::jsonb) ? 'top' OR coalesce(o->'materials','{}'::jsonb) ? 'base')
       AND f.is_active AND f.image_url IS NOT NULL AND lower(f.supplier)=lower(t.brand_name) AND f.category !~* 'fabric|leather|upholster'
       AND (lower(f.name)=lower(btrim(o->>'label')) OR lower(f.name) LIKE lower(btrim(o->>'label'))||'-%' OR lower(f.name) LIKE lower(btrim(o->>'label'))||' %')
     ORDER BY f.name LIMIT 24
   )
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'category',f.category,'brand_name',f.supplier,'image_url',f.image_url,'material_type',NULL,'color_family',NULL) ORDER BY f.ord_n, f.name),'[]'::jsonb) AS list
   FROM (SELECT * FROM linked UNION ALL SELECT * FROM fallback) f
 ) w;
 RETURN result || jsonb_build_object('finish_options',options);
END $function$;

CREATE OR REPLACE FUNCTION public.lock_viewing_room_proposal(_token text, _package_id uuid, _choices jsonb, _request_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
 finish:=finish || jsonb_build_object('materials',coalesce(finish->'materials','{}'::jsonb) || CASE
   WHEN coalesce(colourway->>'category','') !~* 'fabric|leather|upholster' AND NOT (coalesce(finish->'materials','{}'::jsonb) ? 'upholstery') AND (coalesce(finish->'materials','{}'::jsonb) ? 'top' OR coalesce(finish->'materials','{}'::jsonb) ? 'base')
     THEN CASE WHEN (finish->'materials' ? 'top') AND (finish->'materials' ? 'base') THEN jsonb_build_object('top',colourway,'base',colourway)
               WHEN finish->'materials' ? 'top' THEN jsonb_build_object('top',colourway)
               ELSE jsonb_build_object('base',colourway) END
   ELSE jsonb_build_object('upholstery',colourway)
 END);
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

INSERT INTO public.hotspot_slot_rules (furniture_package_id, board_item_id, is_swappable, allow_finish_customization, selection_mode, pinned_alternative_ids, max_price_delta_pct)
SELECT fp.id, cbi.id, true, true, 'manual_curated', '{}'::uuid[], 25
FROM public.furniture_packages fp
JOIN public.client_board_items cbi ON cbi.board_id = fp.moodboard_id
WHERE fp.tier_name = 'Signature'
  AND fp.moodboard_id = 'dce91248-8e44-41af-b399-d9fc65385637'
  AND NOT EXISTS (
    SELECT 1 FROM public.hotspot_slot_rules r
    WHERE r.furniture_package_id = fp.id AND r.board_item_id = cbi.id
  );

UPDATE public.client_board_items
SET variant_label = 'Low table 120 Ø 120 x H 41 cm'
WHERE id = 'b0690c65-40e0-4422-aced-14fda6e6e896'
  AND coalesce(btrim(variant_label), '') = '';

INSERT INTO public.project_studio_finishes (project_id, item_key, selection, updated_by)
SELECT
  'f6068253-c046-44f6-a29d-2efe2fedfb31'::uuid,
  'b0690c65-40e0-4422-aced-14fda6e6e896',
  '{"ids": {"top": "d22fc639-3fa1-42e6-ac55-d6682b8f438e", "base": "d22fc639-3fa1-42e6-ac55-d6682b8f438e"}, "locked": false}'::jsonb,
  p.user_id
FROM public.projects p
WHERE p.id = 'f6068253-c046-44f6-a29d-2efe2fedfb31'::uuid
ON CONFLICT (project_id, item_key) DO NOTHING;