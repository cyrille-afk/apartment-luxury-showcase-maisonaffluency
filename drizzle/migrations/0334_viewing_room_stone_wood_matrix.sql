CREATE OR REPLACE FUNCTION public._viewing_room_swatch_matrix(_product uuid, _currency text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
-- Size-priced pieces (variants without top/base) with linked public stone + wood swatches:
-- one option per stone x wood pair, priced from the first catalogue variant naming that wood.
DECLARE t public.trade_products; rate numeric; out jsonb;
BEGIN
 SELECT * INTO t FROM public.trade_products WHERE id=_product AND is_active AND NOT coalesce(is_hidden,false);
 IF t.id IS NULL OR t.source_pick_id IS NULL OR jsonb_typeof(t.size_variants) IS DISTINCT FROM 'array' THEN RETURN '[]'::jsonb; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(t.size_variants) v WHERE coalesce(v->>'top','')<>'' OR coalesce(v->>'base','')<>'') THEN RETURN '[]'::jsonb; END IF;
 rate:=CASE WHEN coalesce(t.currency,'EUR')=_currency THEN 1 ELSE (SELECT r.rate FROM public.currency_rates r WHERE r.base_currency=coalesce(t.currency,'EUR') AND r.target_currency=_currency ORDER BY r.rate_date DESC LIMIT 1) END;
 IF coalesce(rate,0)<=0 THEN RETURN '[]'::jsonb; END IF;
 WITH sw AS (SELECT s.fabric_id AS id, s.name, s.category, s.supplier, s.image_url, s.sort_order FROM public.product_fabric_swatches_public s WHERE s.pick_id=t.source_pick_id AND s.is_active),
 st AS (SELECT * FROM sw WHERE category ~* 'stone|marble'), wd AS (SELECT * FROM sw WHERE category ~* 'wood'),
 pairs AS (SELECT st, wd, row_number() OVER (ORDER BY wd.sort_order, wd.name, st.sort_order, st.name) AS n,
   (SELECT (v->>'price_cents')::numeric FROM jsonb_array_elements(t.size_variants) WITH ORDINALITY x(v,o) WHERE v->>'price_cents' ~ '^[0-9]+$' AND lower(v->>'label') LIKE '%'||lower(split_part(wd.name,' ',1))||'%' ORDER BY o LIMIT 1) AS cents
   FROM st CROSS JOIN wd)
 SELECT coalesce(jsonb_agg(jsonb_build_object('key','m'||n,'label',(st).name||' / '||(wd).name,'retail_price',round(cents*rate)/100,'lead_time',t.lead_time,
   'materials',jsonb_build_object('top',jsonb_build_object('id',(st).id,'name',(st).name,'category',(st).category,'brand_name',(st).supplier,'image_url',(st).image_url,'material_type',NULL,'color_family',NULL),
     'base',jsonb_build_object('id',(wd).id,'name',(wd).name,'category',(wd).category,'brand_name',(wd).supplier,'image_url',(wd).image_url,'material_type',NULL,'color_family',NULL))) ORDER BY n),'[]'::jsonb) INTO out
 FROM pairs WHERE cents>0;
 RETURN out;
END $$;
REVOKE ALL ON FUNCTION public._viewing_room_swatch_matrix(uuid,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._viewing_room_editorial_product(_item jsonb, _product uuid, _currency text, _variant text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb; options jsonb; t record; m jsonb;
BEGIN
 result:=public._viewing_room_editorial_product_without_axes(_item,_product,_currency,_variant);
 IF jsonb_typeof(result->'finish_options') IS DISTINCT FROM 'array' THEN RETURN result; END IF;
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(result->'finish_options') o WHERE coalesce(o->>'label','')<>'') THEN
  m:=public._viewing_room_swatch_matrix(_product,_currency);
  IF jsonb_array_length(m)>0 THEN RETURN result || jsonb_build_object('finish_options',m); END IF;
  RETURN result;
 END IF;
 SELECT brand_name, base_axis_label, top_axis_label, size_variants::jsonb AS variants INTO t FROM public.trade_products WHERE id=_product;
 IF t IS NULL OR coalesce(t.base_axis_label,'') !~* 'upholst|fabric|leather|seat' OR coalesce(t.top_axis_label,'') !~* 'upholst|fabric|leather|back' OR jsonb_typeof(t.variants) IS DISTINCT FROM 'array' THEN RETURN result; END IF;
 SELECT coalesce(jsonb_agg(CASE WHEN v IS NULL THEN o ELSE o || jsonb_build_object('label',concat_ws(' / ',nullif(v->>'base',''),nullif(v->>'top',''),nullif(frame,'')),'axes',ax.axes,'materials',coalesce(o->'materials','{}'::jsonb)-'top' || CASE WHEN ax.axes->0->'colours'->0 IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('upholstery',ax.axes->0->'colours'->0) END || CASE WHEN ax.axes->1->'colours'->0 IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('backrest',ax.axes->1->'colours'->0) END || CASE WHEN ax.axes->2->'colours'->0 IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('base',ax.axes->2->'colours'->0) END) END ORDER BY ord),'[]'::jsonb) INTO options
 FROM jsonb_array_elements(result->'finish_options') WITH ORDINALITY x(o,ord)
 CROSS JOIN LATERAL (SELECT t.variants->(((o->>'key')::int)-1) AS v) vv
 CROSS JOIN LATERAL (SELECT CASE WHEN coalesce(v->>'label','') ~* '[0-9]+.*(cm|mm)' THEN NULL ELSE nullif(v->>'label','') END AS frame) fr
 CROSS JOIN LATERAL (SELECT jsonb_build_array(
   jsonb_build_object('role','seat','label',t.base_axis_label,'value',v->>'base','colours',public._viewing_room_axis_colours(t.brand_name,v->>'base',true)),
   jsonb_build_object('role','backrest','label',t.top_axis_label,'value',v->>'top','colours',public._viewing_room_axis_colours(t.brand_name,v->>'top',true)),
   jsonb_build_object('role','frame','label','Frame Finish','value',frame,'colours',public._viewing_room_axis_colours(t.brand_name,frame,false))) AS axes) ax;
 RETURN result || jsonb_build_object('finish_options',options);
END $function$;