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
 SELECT coalesce(jsonb_agg(jsonb_build_object('key','m'||n,'label',(st).name||' / '||(wd).name,'retail_price',round(cents*rate)/100,'lead_time',t.lead_time,'image_url',NULL,
   'materials',jsonb_build_object('top',jsonb_build_object('id',(st).id,'name',(st).name,'category',(st).category,'brand_name',(st).supplier,'image_url',(st).image_url,'material_type',NULL,'color_family',NULL),
     'base',jsonb_build_object('id',(wd).id,'name',(wd).name,'category',(wd).category,'brand_name',(wd).supplier,'image_url',(wd).image_url,'material_type',NULL,'color_family',NULL))) ORDER BY n),'[]'::jsonb) INTO out
 FROM pairs WHERE cents>0;
 RETURN out;
END $$;
REVOKE ALL ON FUNCTION public._viewing_room_swatch_matrix(uuid,text) FROM PUBLIC, anon, authenticated;