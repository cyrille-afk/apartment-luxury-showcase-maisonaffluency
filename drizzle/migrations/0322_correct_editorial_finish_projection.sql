CREATE OR REPLACE FUNCTION public._viewing_room_editorial_product(_item jsonb, _product uuid, _currency text, _variant text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.trade_products; rate numeric; retail jsonb; options jsonb; variants jsonb;
BEGIN
 SELECT * INTO t FROM public.trade_products WHERE id=_product AND is_active AND NOT coalesce(is_hidden,false);
 IF t.id IS NULL THEN RETURN _item || jsonb_build_object('finish_options','[]'::jsonb); END IF;
 rate:=CASE WHEN coalesce(t.currency,'EUR')=_currency THEN 1 ELSE (SELECT r.rate FROM public.currency_rates r WHERE r.base_currency=coalesce(t.currency,'EUR') AND r.target_currency=_currency ORDER BY r.rate_date DESC LIMIT 1) END;
 retail:=public._shared_board_retail_price(t.rrp_price_cents,t.size_variants,_variant);
 variants:=CASE WHEN jsonb_typeof(t.size_variants)='array' THEN t.size_variants ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',v.ordinality::text,'label',concat_ws(' / ',nullif(v.value->>'top',''),nullif(v.value->>'base','')),'retail_price',round((v.value->>'price_cents')::numeric*rate)/100,'image_url',_item->'image_url','lead_time',coalesce(v.value->>'lead_time',t.lead_time),'materials',coalesce((SELECT jsonb_object_agg(CASE WHEN axis.role='top' AND f.category ~* 'fabric|leather|upholster' THEN 'upholstery' ELSE axis.role END,jsonb_build_object('id',f.id,'name',f.name,'category',f.category,'brand_name',f.supplier,'image_url',f.image_url,'material_type',NULL,'color_family',NULL)) FROM (VALUES ('top',v.value->>'top'),('base',v.value->>'base')) axis(role,name) JOIN LATERAL (SELECT * FROM public.fabrics f WHERE f.is_active AND lower(f.supplier)=lower(t.brand_name) AND lower(f.name)=lower(axis.name) AND f.image_url IS NOT NULL ORDER BY f.id LIMIT 1) f ON true),'{}'::jsonb)) ORDER BY v.ordinality),'[]'::jsonb) INTO options FROM jsonb_array_elements(variants) WITH ORDINALITY v
 WHERE rate>0 AND v.value->>'price_cents' ~ '^[0-9]+$' AND (v.value->>'price_cents')::numeric>0 AND (v.value ? 'top' OR v.value ? 'base')
 AND (coalesce(v.value->>'label','')='' OR _variant LIKE '%'||(v.value->>'label')||'%' OR (SELECT count(DISTINCT x->>'label') FROM jsonb_array_elements(variants) x)=1)
 AND (coalesce(v.value->>'base','') !~* '[0-9]+.*(cm|mm)' OR _variant LIKE '%'||(v.value->>'base')||'%');
 RETURN _item || jsonb_build_object('retail_price',CASE WHEN rate>0 THEN round((retail->>'cents')::numeric*rate)/100 ELSE NULL END,'retail_price_from',coalesce((retail->>'from')::boolean,false),'finish_options',options);
END $$;
REVOKE ALL ON FUNCTION public._viewing_room_editorial_product(jsonb,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._viewing_room_editorial_product(jsonb,uuid,text,text) TO service_role;