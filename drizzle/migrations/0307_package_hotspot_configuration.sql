ALTER TABLE public.hotspot_slot_rules ADD COLUMN furniture_package_id uuid REFERENCES public.furniture_packages(id) ON DELETE CASCADE, ADD COLUMN board_item_id uuid REFERENCES public.client_board_items(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX hotspot_package_item_unique ON public.hotspot_slot_rules(furniture_package_id,board_item_id) WHERE furniture_package_id IS NOT NULL AND board_item_id IS NOT NULL;
ALTER TABLE public.project_studio_items ADD COLUMN board_item_id uuid REFERENCES public.client_board_items(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX studio_board_item_unique ON public.project_studio_items(board_item_id) WHERE board_item_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.get_package_hotspot_configuration(_project_id uuid,_package_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') OR NOT EXISTS(SELECT 1 FROM furniture_packages p JOIN residence_layouts l ON l.id=p.residence_layout_id JOIN developer_projects d ON d.id=l.developer_project_id WHERE p.id=_package_id AND d.project_id=_project_id) THEN RAISE EXCEPTION 'Administrator project access required'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',t.product_name,'image',t.image_url,'catalog_id',c.id,'category_role',c.category_role,'width_m',c.width_m,'depth_m',c.depth_m,'height_m',c.height_m,'base_price_sgd',c.base_price_sgd,'is_swappable',coalesce(r.is_swappable,false),'allow_finish_customization',coalesce(r.allow_finish_customization,true),'pinned_alternative_ids',coalesce(to_jsonb(r.pinned_alternative_ids),'[]'::jsonb),'alternatives',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'image',at.image_url,'category_role',a.category_role,'width_m',a.width_m,'depth_m',a.depth_m,'height_m',a.height_m,'base_price_sgd',a.base_price_sgd) ORDER BY a.name) FROM catalog_items a LEFT JOIN trade_products at ON at.id=a.id WHERE c.width_m>0 AND c.depth_m>0 AND a.id<>c.id AND a.category_role=c.category_role AND a.width_m BETWEEN c.width_m*0.85 AND c.width_m*1.15 AND a.depth_m BETWEEN c.depth_m*0.85 AND c.depth_m*1.15 AND coalesce(a.glb_url_compressed,a.glb_url_proxy) ~* '^https?://' AND (at.id IS NULL OR (at.is_active AND NOT coalesce(at.is_hidden,false)))),'[]'::jsonb)) ORDER BY i.sort_order,i.id),'[]'::jsonb) INTO result FROM furniture_packages p JOIN client_board_items i ON i.board_id=p.moodboard_id LEFT JOIN trade_products t ON t.id=i.product_id LEFT JOIN catalog_items c ON c.id=i.product_id LEFT JOIN hotspot_slot_rules r ON r.furniture_package_id=p.id AND r.board_item_id=i.id WHERE p.id=_package_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_package_hotspot_configuration(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_package_hotspot_configuration(uuid,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.save_package_hotspot_configuration(_project_id uuid,_package_id uuid,_rules jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE slots jsonb; entry jsonb; slot jsonb; pins uuid[]; studio_id uuid; c public.catalog_items; swappable boolean;
BEGIN
 PERFORM 1 FROM furniture_packages WHERE id=_package_id FOR UPDATE;
 slots:=public.get_package_hotspot_configuration(_project_id,_package_id);
 IF jsonb_typeof(_rules)<>'array' OR jsonb_array_length(_rules)<>jsonb_array_length(slots) OR (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(_rules)e)<>jsonb_array_length(slots) THEN RAISE EXCEPTION 'Every board item must appear exactly once'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(_rules) LOOP
  SELECT value INTO slot FROM jsonb_array_elements(slots) WHERE value->>'id'=entry->>'id';
  IF slot IS NULL THEN RAISE EXCEPTION 'Invalid board item'; END IF;
  swappable:=coalesce((entry->>'is_swappable')::boolean,false);
  IF jsonb_typeof(entry->'pinned_alternative_ids')<>'array' THEN RAISE EXCEPTION 'Invalid alternatives'; END IF;
  SELECT coalesce(array_agg(value::uuid),'{}'::uuid[]) INTO pins FROM jsonb_array_elements_text(entry->'pinned_alternative_ids');
  IF cardinality(pins)<>(SELECT count(DISTINCT x) FROM unnest(pins)x) OR cardinality(pins)>4 OR (swappable AND cardinality(pins)<2) THEN RAISE EXCEPTION 'Enabled swaps require 2 to 4 unique approved options'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(pins) id WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(slot->'alternatives') a WHERE a->>'id'=id::text)) THEN RAISE EXCEPTION 'Alternative category or dimensions are incompatible'; END IF;
  SELECT id INTO studio_id FROM project_studio_items WHERE project_id=_project_id AND board_item_id=(entry->>'id')::uuid;
  IF studio_id IS NULL AND slot->>'catalog_id' IS NOT NULL THEN
   SELECT * INTO c FROM catalog_items WHERE id=(slot->>'catalog_id')::uuid;
   IF c.base_price_sgd IS NOT NULL AND c.base_lead_time_weeks IS NOT NULL THEN
    INSERT INTO project_studio_items(project_id,board_item_id,catalog_item_id,locked_finishes,calculated_price,calculated_lead_time_weeks) VALUES(_project_id,(entry->>'id')::uuid,c.id,'{}'::jsonb,c.base_price_sgd,c.base_lead_time_weeks) RETURNING id INTO studio_id;
   END IF;
  END IF;
  INSERT INTO hotspot_slot_rules(project_studio_item_id,furniture_package_id,board_item_id,is_swappable,allow_finish_customization,selection_mode,pinned_alternative_ids) VALUES(studio_id,_package_id,(entry->>'id')::uuid,swappable,coalesce((entry->>'allow_finish_customization')::boolean,false),'manual_curated',pins) ON CONFLICT(furniture_package_id,board_item_id) WHERE furniture_package_id IS NOT NULL AND board_item_id IS NOT NULL DO UPDATE SET project_studio_item_id=coalesce(EXCLUDED.project_studio_item_id,hotspot_slot_rules.project_studio_item_id),is_swappable=EXCLUDED.is_swappable,allow_finish_customization=EXCLUDED.allow_finish_customization,selection_mode='manual_curated',pinned_alternative_ids=EXCLUDED.pinned_alternative_ids;
 END LOOP;
 RETURN public.get_package_hotspot_configuration(_project_id,_package_id);
END $$;
REVOKE ALL ON FUNCTION public.save_package_hotspot_configuration(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_package_hotspot_configuration(uuid,uuid,jsonb) TO authenticated,service_role;