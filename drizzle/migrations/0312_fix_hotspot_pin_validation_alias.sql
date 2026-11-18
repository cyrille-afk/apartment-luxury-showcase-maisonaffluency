CREATE OR REPLACE FUNCTION public.save_package_hotspot_configuration(_project_id uuid,_package_id uuid,_rules jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  slots jsonb; entry jsonb; slot jsonb; pins uuid[]; studio_id uuid; linked_id uuid; swappable boolean;
  override_role text; override_w numeric; override_d numeric; override_h numeric;
  linked_role text; linked_w numeric; linked_d numeric; effective_role text; effective_w numeric; effective_d numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') OR NOT EXISTS(SELECT 1 FROM public.furniture_packages p JOIN public.residence_layouts l ON l.id=p.residence_layout_id JOIN public.developer_projects d ON d.id=l.developer_project_id WHERE p.id=_package_id AND d.project_id=_project_id) THEN RAISE EXCEPTION 'Administrator project access required'; END IF;
  PERFORM 1 FROM public.furniture_packages WHERE id=_package_id FOR UPDATE;
  slots:=public.get_package_hotspot_configuration(_project_id,_package_id);
  IF jsonb_typeof(_rules)<>'array' OR jsonb_array_length(_rules)<>jsonb_array_length(slots) OR (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(_rules)e)<>jsonb_array_length(slots) THEN RAISE EXCEPTION 'Every board item must appear exactly once'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(_rules) LOOP
    SELECT value INTO slot FROM jsonb_array_elements(slots) WHERE value->>'id'=entry->>'id';
    IF slot IS NULL THEN RAISE EXCEPTION 'Invalid board item'; END IF;
    swappable:=coalesce((entry->>'is_swappable')::boolean,false);
    IF jsonb_typeof(entry->'pinned_alternative_ids')<>'array' THEN RAISE EXCEPTION 'Invalid alternatives'; END IF;
    SELECT coalesce(array_agg(value::uuid),'{}'::uuid[]) INTO pins FROM jsonb_array_elements_text(entry->'pinned_alternative_ids');
    override_role:=NULLIF(btrim(entry->>'category_role_override'),'');
    override_w:=(entry->>'width_m_override')::numeric; override_d:=(entry->>'depth_m_override')::numeric; override_h:=(entry->>'height_m_override')::numeric;
    IF override_role IS NOT NULL AND override_role NOT IN ('sofa','lounge_chair','coffee_table','side_table','console') THEN RAISE EXCEPTION 'Choose a supported category'; END IF;
    IF override_w<=0 OR override_d<=0 OR override_h<=0 THEN RAISE EXCEPTION 'Measurements must be positive'; END IF;
    SELECT psi.id,psi.catalog_item_id,c.category_role,c.width_m,c.depth_m INTO studio_id,linked_id,linked_role,linked_w,linked_d FROM public.project_studio_items psi LEFT JOIN public.catalog_items c ON c.id=psi.catalog_item_id WHERE psi.project_id=_project_id AND psi.board_item_id=(entry->>'id')::uuid;
    effective_role:=coalesce(override_role,linked_role); effective_w:=coalesce(override_w,linked_w); effective_d:=coalesce(override_d,linked_d);
    IF swappable AND (effective_role IS NULL OR effective_w IS NULL OR effective_d IS NULL OR effective_w<=0 OR effective_d<=0) THEN RAISE EXCEPTION 'Add a category and dimensions before enabling swaps'; END IF;
    IF cardinality(pins)<>(SELECT count(DISTINCT x) FROM unnest(pins)x) OR cardinality(pins)>4 OR (swappable AND cardinality(pins)<2) THEN RAISE EXCEPTION 'Enabled swaps require 2 to 4 unique approved options'; END IF;
    IF EXISTS(SELECT 1 FROM unnest(pins) pin_id WHERE NOT EXISTS(SELECT 1 FROM public.catalog_items a LEFT JOIN public.trade_products at ON at.id=a.id WHERE a.id=pin_id AND (linked_id IS NULL OR a.id<>linked_id) AND a.category_role=effective_role AND effective_w>0 AND effective_d>0 AND a.width_m BETWEEN effective_w*0.85 AND effective_w*1.15 AND a.depth_m BETWEEN effective_d*0.85 AND effective_d*1.15 AND coalesce(a.glb_url_compressed,a.glb_url_proxy) ~* '^https?://' AND (at.id IS NULL OR (at.is_active AND NOT coalesce(at.is_hidden,false))))) THEN RAISE EXCEPTION 'Alternative category or dimensions are incompatible'; END IF;
    INSERT INTO public.hotspot_slot_rules(project_studio_item_id,furniture_package_id,board_item_id,is_swappable,allow_finish_customization,selection_mode,pinned_alternative_ids,category_role_override,width_m_override,depth_m_override,height_m_override)
    VALUES(studio_id,_package_id,(entry->>'id')::uuid,swappable,coalesce((entry->>'allow_finish_customization')::boolean,false),'manual_curated',pins,override_role,override_w,override_d,override_h)
    ON CONFLICT(furniture_package_id,board_item_id) WHERE furniture_package_id IS NOT NULL AND board_item_id IS NOT NULL DO UPDATE SET project_studio_item_id=coalesce(EXCLUDED.project_studio_item_id,public.hotspot_slot_rules.project_studio_item_id),is_swappable=EXCLUDED.is_swappable,allow_finish_customization=EXCLUDED.allow_finish_customization,selection_mode='manual_curated',pinned_alternative_ids=EXCLUDED.pinned_alternative_ids,category_role_override=EXCLUDED.category_role_override,width_m_override=EXCLUDED.width_m_override,depth_m_override=EXCLUDED.depth_m_override,height_m_override=EXCLUDED.height_m_override;
  END LOOP;
  RETURN public.get_package_hotspot_configuration(_project_id,_package_id);
END $$;
REVOKE ALL ON FUNCTION public.save_package_hotspot_configuration(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_package_hotspot_configuration(uuid,uuid,jsonb) TO authenticated,service_role;