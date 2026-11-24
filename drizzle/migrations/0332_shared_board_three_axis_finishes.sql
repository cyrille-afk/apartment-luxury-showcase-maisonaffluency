CREATE OR REPLACE FUNCTION public.get_shared_board_finishes(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
DECLARE inv public.board_invites; _out jsonb;
BEGIN
 inv := public._board_invite_by_token(_token);
 IF inv.id IS NULL THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_object_agg(x.product_id,x.data),'{}'::jsonb) INTO _out FROM (
 SELECT DISTINCT ON (tp.id) tp.id::text AS product_id, jsonb_build_object(
 'variants',coalesce((SELECT jsonb_agg(jsonb_build_object('top',v->>'top','base',v->>'base','label',v->>'label','price_cents',(v->>'price_cents')::numeric,
 'axes',CASE WHEN coalesce(p.base_axis_label,'') ~* 'upholst|fabric|leather|seat' AND coalesce(p.top_axis_label,'') ~* 'upholst|fabric|leather|back' THEN jsonb_build_array(
 jsonb_build_object('role','seat','label',p.base_axis_label,'value',v->>'base','colours',public._viewing_room_axis_colours(tp.brand_name,v->>'base',true)),
 jsonb_build_object('role','backrest','label',p.top_axis_label,'value',v->>'top','colours',public._viewing_room_axis_colours(tp.brand_name,v->>'top',true)),
 jsonb_build_object('role','frame','label','Frame Finish','value',CASE WHEN coalesce(v->>'label','') ~* '[0-9]+.*(cm|mm)' THEN NULL ELSE nullif(v->>'label','') END,'colours',public._viewing_room_axis_colours(tp.brand_name,CASE WHEN coalesce(v->>'label','') ~* '[0-9]+.*(cm|mm)' THEN NULL ELSE nullif(v->>'label','') END,false))) ELSE '[]'::jsonb END))
 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.size_variants)='array' THEN p.size_variants ELSE '[]'::jsonb END) v WHERE coalesce(v->>'top',v->>'base') IS NOT NULL),'[]'::jsonb),
 'variant_image_map',coalesce(p.variant_image_map,'{}'::jsonb),'gallery_images',coalesce(to_jsonb(p.gallery_images),'[]'::jsonb),
 'swatches',coalesce((SELECT jsonb_agg(jsonb_build_object('name',s.name,'image_url',s.image_url,'category',s.category,'price_tier_label',s.price_tier_label)) FROM public.product_fabric_swatches_public s WHERE s.pick_id=p.id AND s.is_active=true),'[]'::jsonb),
 'glbs',coalesce((SELECT jsonb_agg(jsonb_build_object('variant_label',g.variant_label,'glb_url',g.glb_url,'is_default',g.is_default,'material_roles',g.material_roles)) FROM public.trade_product_glb_variants g WHERE g.product_id=tp.id),'[]'::jsonb),
 'currency',coalesce(tp.currency,'EUR'),'lead',coalesce(tp.lead_time,CASE WHEN tp.lead_time_weeks_min IS NOT NULL THEN tp.lead_time_weeks_min||'–'||coalesce(tp.lead_time_weeks_max,tp.lead_time_weeks_min)||' weeks' END)) AS data
 FROM public.client_board_items bi JOIN public.trade_products tp ON tp.id=bi.product_id LEFT JOIN public.designer_curator_picks p ON p.id=tp.source_pick_id WHERE bi.board_id=inv.board_id) x;
 RETURN _out;
END $$;
REVOKE ALL ON FUNCTION public.get_shared_board_finishes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_board_finishes(text) TO anon, authenticated, service_role;