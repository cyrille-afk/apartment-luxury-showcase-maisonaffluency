CREATE OR REPLACE FUNCTION public._viewing_room_footprint_alternatives(_package_id uuid,_slot_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.furniture_packages; r public.hotspot_slot_rules; source_id uuid; role text; w numeric; d numeric; result jsonb;
BEGIN
 SELECT * INTO p FROM public.furniture_packages WHERE id=_package_id;
 SELECT * INTO r FROM public.hotspot_slot_rules WHERE furniture_package_id=p.id AND board_item_id=_slot_id;
 IF r.id IS NULL OR NOT coalesce(r.is_swappable,false) OR NOT coalesce(p.allow_alternatives,false) THEN RETURN '[]'::jsonb; END IF;
 SELECT coalesce(psi.catalog_item_id,i.product_id) INTO source_id FROM public.client_board_items i JOIN public.residence_layouts l ON l.id=p.residence_layout_id JOIN public.developer_projects dev ON dev.id=l.developer_project_id LEFT JOIN public.project_studio_items psi ON psi.board_item_id=i.id AND psi.project_id=dev.project_id WHERE i.id=_slot_id AND i.board_id=p.moodboard_id;
 SELECT coalesce(r.category_role_override,c.category_role),coalesce(r.width_m_override,c.width_m),coalesce(r.depth_m_override,c.depth_m) INTO role,w,d FROM (SELECT 1) s LEFT JOIN public.catalog_items c ON c.id=source_id;
 IF role IS NULL OR w IS NULL OR d IS NULL OR w<=0 OR d<=0 THEN RETURN '[]'::jsonb; END IF;
 SELECT coalesce(jsonb_agg(public._viewing_room_editorial_product(x.item,x.id,p.currency,NULL) ORDER BY x.pin_order,x.distance,x.name),'[]'::jsonb) INTO result FROM (
 SELECT c.id,c.name,array_position(r.pinned_alternative_ids,c.id) AS pin_order,abs(c.width_m/w-1)+abs(c.depth_m/d-1) AS distance,jsonb_build_object('id',c.id,'product_name',c.name,'category',c.category_role,'subcategory',NULL,'image_url',t.image_url,'dimensions',concat(c.width_m,' × ',c.depth_m,' × ',c.height_m,' m'),'width_mm',c.width_m*1000,'depth_mm',c.depth_m*1000,'height_mm',c.height_m*1000,'glb_url',coalesce(c.glb_url_compressed,c.glb_url_proxy),'lead_time',CASE WHEN c.base_lead_time_weeks>0 THEN c.base_lead_time_weeks::text||' weeks' ELSE t.lead_time END,'materials','{}'::jsonb,'retail_price',CASE WHEN p.currency='SGD' THEN NULLIF(c.base_price_sgd,0) ELSE NULLIF(c.base_price_sgd,0)*(SELECT cr.rate FROM public.currency_rates cr WHERE cr.base_currency='SGD' AND cr.target_currency=p.currency ORDER BY cr.rate_date DESC LIMIT 1) END,'retail_price_from',false) AS item
 FROM public.catalog_items c LEFT JOIN public.trade_products t ON t.id=c.id WHERE c.id<>source_id AND c.category_role=role AND c.width_m BETWEEN w*0.80 AND w*1.20 AND c.depth_m BETWEEN d*0.80 AND d*1.20 AND coalesce(c.glb_url_compressed,c.glb_url_proxy) ~* '^https://[^[:space:]]+\.(glb|gltf|obj)([?#].*)?$' AND (t.id IS NULL OR (t.is_active AND NOT coalesce(t.is_hidden,false))) AND (coalesce(cardinality(r.pinned_alternative_ids),0)=0 OR c.id=ANY(r.pinned_alternative_ids))
 ORDER BY array_position(r.pinned_alternative_ids,c.id),abs(c.width_m/w-1)+abs(c.depth_m/d-1),c.name,c.id LIMIT 4
 ) x;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public._viewing_room_footprint_alternatives(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._viewing_room_footprint_alternatives(uuid,uuid) TO service_role;