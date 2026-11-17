ALTER TABLE public.furniture_packages ADD COLUMN lead_time_weeks integer CHECK (lead_time_weeks > 0);
CREATE OR REPLACE FUNCTION public.get_developer_viewing_room(_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.developer_projects;
BEGIN
 IF _token IS NULL OR length(_token)>128 THEN RETURN NULL; END IF;
 SELECT * INTO d FROM public.developer_projects WHERE access_token=_token;
 IF d.id IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('name',d.developer_name,'logo',d.developer_logo_url,'hero',d.hero_image_url,'project_name',(SELECT name FROM public.projects WHERE id=d.project_id),'layouts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'floorplan_url',r.floorplan_url,'specs_label',r.specs_label,'room_environment_glb',r.room_environment_glb,'packages',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'tier_name',p.tier_name,'package_price',p.package_price,'currency',p.currency,'description',p.description,'lead_time_weeks',p.lead_time_weeks) ORDER BY p.sort_order) FROM public.furniture_packages p WHERE p.residence_layout_id=r.id),'[]'::jsonb)) ORDER BY r.created_at) FROM (SELECT * FROM public.residence_layouts WHERE developer_project_id=d.id ORDER BY created_at LIMIT 5) r),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.get_developer_viewing_room(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_developer_viewing_room(text) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.get_viewing_room_package(_token text,_package_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE board uuid; project uuid;
BEGIN
 IF _token IS NULL OR length(_token)>128 THEN RETURN NULL; END IF;
 SELECT p.moodboard_id,d.project_id INTO board,project FROM public.furniture_packages p JOIN public.residence_layouts r ON r.id=p.residence_layout_id JOIN public.developer_projects d ON d.id=r.developer_project_id JOIN public.client_boards b ON b.id=p.moodboard_id AND b.project_id=d.project_id WHERE p.id=_package_id AND d.access_token=_token;
 IF board IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'product_name',t.product_name,'category',t.category,'subcategory',t.subcategory,'image_url',t.image_url,'dimensions',t.dimensions,'width_mm',t.width_mm,'depth_mm',t.depth_mm,'height_mm',t.height_mm,'glb_url',coalesce((SELECT c.glb_url_compressed FROM public.catalog_items c WHERE c.id=t.id),t.glb_url),'lead_time',t.lead_time,'materials',coalesce((SELECT jsonb_object_agg(f.key,jsonb_build_object('id',fab.id,'name',fab.name,'category',fab.category,'brand_name','','image_url',fab.image_url,'material_type',fab.category,'color_family',null)) FROM public.project_studio_finishes s CROSS JOIN LATERAL jsonb_each_text(s.selection->'ids') f JOIN public.fabrics fab ON fab.id::text=f.value WHERE s.project_id=project AND s.item_key=i.id::text),'{}'::jsonb)) ORDER BY i.sort_order) FROM (SELECT * FROM public.client_board_items WHERE board_id=board ORDER BY sort_order LIMIT 50) i JOIN public.trade_products t ON t.id=i.product_id WHERE NOT EXISTS(SELECT 1 FROM public.project_studio_finishes s WHERE s.project_id=project AND s.item_key=i.id::text AND s.selection->>'excluded'='true')),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.get_viewing_room_package(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viewing_room_package(text,uuid) TO anon, authenticated;