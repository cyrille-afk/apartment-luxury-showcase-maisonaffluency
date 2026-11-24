CREATE OR REPLACE FUNCTION public._viewing_room_editorial_product(_item jsonb,_product uuid,_currency text,_variant text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; options jsonb; t record;
BEGIN
 result:=public._viewing_room_editorial_product_without_axes(_item,_product,_currency,_variant);
 IF jsonb_typeof(result->'finish_options') IS DISTINCT FROM 'array' THEN RETURN result; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public._viewing_room_editorial_product(jsonb,uuid,text,text) FROM PUBLIC, anon, authenticated;