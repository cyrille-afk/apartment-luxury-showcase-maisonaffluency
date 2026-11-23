CREATE OR REPLACE FUNCTION public._viewing_room_editorial_product(_item jsonb, _product uuid, _currency text, _variant text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result jsonb; options jsonb; roles jsonb;
BEGIN
 result:=public._viewing_room_editorial_product_without_colourways(_item,_product,_currency,_variant);
 SELECT v.material_roles INTO roles FROM public.trade_product_glb_variants v
  WHERE v.product_id=_product AND v.material_roles IS NOT NULL AND v.material_roles<>'{}'::jsonb
  ORDER BY (v.glb_url = result->>'glb_url') DESC, v.is_default DESC NULLS LAST LIMIT 1;
 IF roles IS NOT NULL THEN result:=result || jsonb_build_object('material_roles',roles); END IF;
 IF jsonb_typeof(result->'finish_options') IS DISTINCT FROM 'array' THEN RETURN result; END IF;
 SELECT coalesce(jsonb_agg(CASE WHEN jsonb_array_length(c.list)>0 THEN o || jsonb_build_object('colourways',c.list,'materials',coalesce(o->'materials','{}'::jsonb) || CASE WHEN o->'materials' ? 'upholstery' THEN '{}'::jsonb ELSE jsonb_build_object('upholstery',c.list->0) END) ELSE o END ORDER BY ord),'[]'::jsonb) INTO options
 FROM jsonb_array_elements(result->'finish_options') WITH ORDINALITY x(o,ord)
 CROSS JOIN LATERAL (SELECT btrim((regexp_match(o->>'label','Fabric\s+Cat\.?\s*([^/·]+)','i'))[1]) AS family) fam
 CROSS JOIN LATERAL (SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'category',f.category,'brand_name',f.supplier,'image_url',f.image_url,'material_type',NULL,'color_family',NULL) ORDER BY f.name),'[]'::jsonb) AS list FROM (SELECT * FROM public.fabrics f WHERE fam.family IS NOT NULL AND f.is_active AND f.image_url IS NOT NULL AND f.category ~* 'fabric|leather|upholster' AND (lower(f.name)=lower(fam.family) OR lower(f.name) LIKE lower(fam.family)||' %') ORDER BY f.name LIMIT 24) f) c;
 RETURN result || jsonb_build_object('finish_options',options);
END $function$;