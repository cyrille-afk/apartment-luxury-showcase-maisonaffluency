ALTER TABLE public.hotspot_slot_rules
  ADD COLUMN category_role_override text,
  ADD COLUMN width_m_override numeric(6,3),
  ADD COLUMN depth_m_override numeric(6,3),
  ADD COLUMN height_m_override numeric(6,3);

ALTER TABLE public.hotspot_slot_rules
  ADD CONSTRAINT hotspot_category_override_allowed CHECK (category_role_override IS NULL OR category_role_override IN ('sofa','lounge_chair','coffee_table','side_table','console')),
  ADD CONSTRAINT hotspot_width_override_positive CHECK (width_m_override IS NULL OR width_m_override > 0),
  ADD CONSTRAINT hotspot_depth_override_positive CHECK (depth_m_override IS NULL OR depth_m_override > 0),
  ADD CONSTRAINT hotspot_height_override_positive CHECK (height_m_override IS NULL OR height_m_override > 0);

CREATE OR REPLACE FUNCTION public.hotspot_category_role(_category text,_subcategory text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE
    WHEN lower(concat_ws(' ',_category,_subcategory)) LIKE '%sofa%' THEN 'sofa'
    WHEN lower(concat_ws(' ',_category,_subcategory)) LIKE '%coffee table%' THEN 'coffee_table'
    WHEN lower(concat_ws(' ',_category,_subcategory)) LIKE '%side table%' OR lower(concat_ws(' ',_category,_subcategory)) LIKE '%bedside%' THEN 'side_table'
    WHEN lower(concat_ws(' ',_category,_subcategory)) LIKE '%console%' OR lower(concat_ws(' ',_category,_subcategory)) LIKE '%sideboard%' OR lower(concat_ws(' ',_category,_subcategory)) LIKE '%buffet%' THEN 'console'
    WHEN lower(concat_ws(' ',_category,_subcategory)) LIKE '%armchair%' OR lower(concat_ws(' ',_category,_subcategory)) LIKE '%lounge chair%' OR lower(concat_ws(' ',_category,_subcategory)) LIKE '%chair%' THEN 'lounge_chair'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.hotspot_dimension_values(_dimensions text,_width_mm integer,_depth_mm integer,_height_mm integer,_size_variants jsonb)
RETURNS TABLE(width_m numeric,depth_m numeric,height_m numeric)
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE
  w numeric := CASE WHEN _width_mm>0 THEN _width_mm/1000.0 END;
  d numeric := CASE WHEN _depth_mm>0 THEN _depth_mm/1000.0 END;
  h numeric := CASE WHEN _height_mm>0 THEN _height_mm/1000.0 END;
  candidate text; parsed record; diameter text; triple text[]; factor numeric;
BEGIN
  FOR candidate IN
    SELECT value FROM (
      SELECT NULLIF(btrim(_dimensions),'') AS value
      UNION ALL
      SELECT NULLIF(btrim(v->>k.key),'') FROM jsonb_array_elements(coalesce(_size_variants,'[]'::jsonb)) v CROSS JOIN (VALUES ('label'),('base'),('top')) k(key)
    ) candidates WHERE value IS NOT NULL
  LOOP
    SELECT p.width_mm,p.depth_mm,p.height_mm INTO parsed FROM public.parse_dimensions_to_mm(candidate) p;
    factor := CASE WHEN candidate ~* '\ym\y' AND candidate !~* '\ymm\y' THEN 100 ELSE 1 END;
    w := coalesce(w,NULLIF(parsed.width_mm,0)*factor/1000.0);
    d := coalesce(d,NULLIF(parsed.depth_mm,0)*factor/1000.0);
    h := coalesce(h,NULLIF(parsed.height_mm,0)*factor/1000.0);
    diameter := (regexp_match(candidate,'[ØøΦ][[:space:]]*([0-9]+([.][0-9]+)?)'))[1];
    IF diameter IS NOT NULL THEN
      factor := CASE WHEN candidate ~* '\ymm\y' THEN 0.001 WHEN candidate ~* '\ym\y' THEN 1 ELSE 0.01 END;
      w := coalesce(w,diameter::numeric*factor); d := coalesce(d,diameter::numeric*factor);
    END IF;
    triple := regexp_match(candidate,'^\s*([0-9]+([.][0-9]+)?)\s*[×xX]\s*([0-9]+([.][0-9]+)?)\s*[×xX]\s*H');
    IF triple IS NOT NULL THEN
      factor := CASE WHEN candidate ~* '\ymm\y' THEN 0.001 WHEN candidate ~* '\ym\y' THEN 1 ELSE 0.01 END;
      w := coalesce(w,triple[1]::numeric*factor); d := coalesce(d,triple[3]::numeric*factor);
    END IF;
    IF w>0 AND d>0 AND h>0 THEN
      width_m:=w; depth_m:=d; height_m:=h; RETURN NEXT; RETURN;
    END IF;
  END LOOP;
  width_m:=w; depth_m:=d; height_m:=h; RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.hotspot_price_sgd(_product public.trade_products)
RETURNS numeric LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT round((public._shared_board_retail_price(_product.rrp_price_cents,_product.size_variants,NULL)->>'cents')::numeric/100.0 * coalesce((SELECT rate FROM public.currency_rates WHERE base_currency='EUR' AND target_currency='SGD' ORDER BY rate_date DESC LIMIT 1),0),2)
$$;

CREATE OR REPLACE FUNCTION public.hotspot_sync_trade_product(_product public.trade_products)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE catalog_id uuid; matches integer; role text; dims record; price numeric;
BEGIN
  SELECT c.id INTO catalog_id FROM public.catalog_items c WHERE c.id=_product.id;
  IF catalog_id IS NULL AND NULLIF(btrim(_product.sku),'') IS NOT NULL THEN
    SELECT c.id INTO catalog_id FROM public.catalog_items c WHERE c.sku=_product.sku;
  END IF;
  IF catalog_id IS NULL THEN
    SELECT count(*),(array_agg(c.id))[1] INTO matches,catalog_id FROM public.catalog_items c WHERE lower(btrim(c.name))=lower(btrim(_product.product_name));
    IF matches<>1 THEN catalog_id:=NULL; END IF;
  END IF;
  IF catalog_id IS NOT NULL THEN RETURN catalog_id; END IF;
  role:=public.hotspot_category_role(_product.category,_product.subcategory);
  SELECT * INTO dims FROM public.hotspot_dimension_values(_product.dimensions,_product.width_mm,_product.depth_mm,_product.height_mm,_product.size_variants);
  IF role IS NULL OR dims.width_m IS NULL OR dims.depth_m IS NULL OR dims.height_m IS NULL OR _product.glb_url !~* '^https?://' THEN RETURN NULL; END IF;
  price:=coalesce(public.hotspot_price_sgd(_product),0);
  INSERT INTO public.catalog_items(id,sku,name,designer,category_role,room_type,width_m,depth_m,height_m,glb_url_compressed,glb_url_proxy,base_price_sgd,base_lead_time_weeks)
  VALUES(_product.id,coalesce(NULLIF(btrim(_product.sku),''),_product.id::text),_product.product_name,_product.brand_name,role,'{}'::text[],dims.width_m,dims.depth_m,dims.height_m,_product.glb_url,NULL,price,coalesce(_product.lead_time_weeks_min,_product.lead_time_weeks_max,0));
  RETURN _product.id;
END $$;
REVOKE ALL ON FUNCTION public.hotspot_sync_trade_product(public.trade_products) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hotspot_sync_trade_product(public.trade_products) TO service_role;

CREATE OR REPLACE FUNCTION public.link_package_hotspot_catalog(_project_id uuid,_package_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE product public.trade_products; catalog_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') OR NOT EXISTS(SELECT 1 FROM public.furniture_packages p JOIN public.residence_layouts l ON l.id=p.residence_layout_id JOIN public.developer_projects d ON d.id=l.developer_project_id WHERE p.id=_package_id AND d.project_id=_project_id) THEN RAISE EXCEPTION 'Administrator project access required'; END IF;
  FOR product IN SELECT * FROM public.trade_products WHERE is_active AND NOT coalesce(is_hidden,false) AND glb_url ~* '^https?://' LOOP
    PERFORM public.hotspot_sync_trade_product(product);
  END LOOP;
  FOR product IN SELECT t.* FROM public.furniture_packages p JOIN public.client_board_items i ON i.board_id=p.moodboard_id JOIN public.trade_products t ON t.id=i.product_id WHERE p.id=_package_id LOOP
    catalog_id:=public.hotspot_sync_trade_product(product);
    IF catalog_id IS NOT NULL THEN
      INSERT INTO public.project_studio_items(project_id,board_item_id,catalog_item_id,locked_finishes,calculated_price,calculated_lead_time_weeks)
      SELECT _project_id,i.id,c.id,'{}'::jsonb,c.base_price_sgd,c.base_lead_time_weeks FROM public.client_board_items i JOIN public.furniture_packages p ON p.moodboard_id=i.board_id JOIN public.catalog_items c ON c.id=catalog_id WHERE p.id=_package_id AND i.product_id=product.id
      ON CONFLICT(board_item_id) WHERE board_item_id IS NOT NULL DO UPDATE SET catalog_item_id=coalesce(public.project_studio_items.catalog_item_id,EXCLUDED.catalog_item_id);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.link_package_hotspot_catalog(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.link_package_hotspot_catalog(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_package_hotspot_configuration(_project_id uuid,_package_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.link_package_hotspot_catalog(_project_id,_package_id);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',t.product_name,'image',t.image_url,'catalog_id',c.id,'category_role',s.category_role,'width_m',s.width_m,'depth_m',s.depth_m,'height_m',s.height_m,'base_price_sgd',NULLIF(c.base_price_sgd,0),'category_role_override',r.category_role_override,'width_m_override',r.width_m_override,'depth_m_override',r.depth_m_override,'height_m_override',r.height_m_override,'is_swappable',coalesce(r.is_swappable,false),'allow_finish_customization',coalesce(r.allow_finish_customization,true),'pinned_alternative_ids',coalesce(to_jsonb(r.pinned_alternative_ids),'[]'::jsonb),'alternatives',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'image',at.image_url,'category_role',a.category_role,'width_m',a.width_m,'depth_m',a.depth_m,'height_m',a.height_m,'base_price_sgd',NULLIF(a.base_price_sgd,0)) ORDER BY a.name) FROM public.catalog_items a LEFT JOIN public.trade_products at ON at.id=a.id WHERE s.width_m>0 AND s.depth_m>0 AND (c.id IS NULL OR a.id<>c.id) AND a.category_role=s.category_role AND a.width_m BETWEEN s.width_m*0.85 AND s.width_m*1.15 AND a.depth_m BETWEEN s.depth_m*0.85 AND s.depth_m*1.15 AND coalesce(a.glb_url_compressed,a.glb_url_proxy) ~* '^https?://' AND (at.id IS NULL OR (at.is_active AND NOT coalesce(at.is_hidden,false)))),'[]'::jsonb)) ORDER BY i.sort_order,i.id),'[]'::jsonb) INTO result
  FROM public.furniture_packages p
  JOIN public.client_board_items i ON i.board_id=p.moodboard_id
  LEFT JOIN public.trade_products t ON t.id=i.product_id
  LEFT JOIN public.project_studio_items psi ON psi.board_item_id=i.id AND psi.project_id=_project_id
  LEFT JOIN public.catalog_items c ON c.id=psi.catalog_item_id
  LEFT JOIN public.hotspot_slot_rules r ON r.furniture_package_id=p.id AND r.board_item_id=i.id
  CROSS JOIN LATERAL (SELECT coalesce(r.category_role_override,c.category_role) AS category_role,coalesce(r.width_m_override,c.width_m) AS width_m,coalesce(r.depth_m_override,c.depth_m) AS depth_m,coalesce(r.height_m_override,c.height_m) AS height_m) s
  WHERE p.id=_package_id;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_package_hotspot_configuration(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_package_hotspot_configuration(uuid,uuid) TO authenticated,service_role;

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
    IF (override_w IS NULL)<>(override_d IS NULL) OR (override_w IS NULL)<>(override_h IS NULL) OR override_w<=0 OR override_d<=0 OR override_h<=0 THEN RAISE EXCEPTION 'Enter positive W, D and H measurements together'; END IF;
    SELECT psi.id,psi.catalog_item_id,c.category_role,c.width_m,c.depth_m INTO studio_id,linked_id,linked_role,linked_w,linked_d FROM public.project_studio_items psi LEFT JOIN public.catalog_items c ON c.id=psi.catalog_item_id WHERE psi.project_id=_project_id AND psi.board_item_id=(entry->>'id')::uuid;
    effective_role:=coalesce(override_role,linked_role); effective_w:=coalesce(override_w,linked_w); effective_d:=coalesce(override_d,linked_d);
    IF swappable AND (effective_role IS NULL OR effective_w IS NULL OR effective_d IS NULL OR effective_w<=0 OR effective_d<=0) THEN RAISE EXCEPTION 'Add a category and dimensions before enabling swaps'; END IF;
    IF cardinality(pins)<>(SELECT count(DISTINCT x) FROM unnest(pins)x) OR cardinality(pins)>4 OR (swappable AND cardinality(pins)<2) THEN RAISE EXCEPTION 'Enabled swaps require 2 to 4 unique approved options'; END IF;
    IF EXISTS(SELECT 1 FROM unnest(pins) id WHERE NOT EXISTS(SELECT 1 FROM public.catalog_items a LEFT JOIN public.trade_products at ON at.id=a.id WHERE a.id=id AND (linked_id IS NULL OR a.id<>linked_id) AND a.category_role=effective_role AND effective_w>0 AND effective_d>0 AND a.width_m BETWEEN effective_w*0.85 AND effective_w*1.15 AND a.depth_m BETWEEN effective_d*0.85 AND effective_d*1.15 AND coalesce(a.glb_url_compressed,a.glb_url_proxy) ~* '^https?://' AND (at.id IS NULL OR (at.is_active AND NOT coalesce(at.is_hidden,false))))) THEN RAISE EXCEPTION 'Alternative category or dimensions are incompatible'; END IF;
    INSERT INTO public.hotspot_slot_rules(project_studio_item_id,furniture_package_id,board_item_id,is_swappable,allow_finish_customization,selection_mode,pinned_alternative_ids,category_role_override,width_m_override,depth_m_override,height_m_override)
    VALUES(studio_id,_package_id,(entry->>'id')::uuid,swappable,coalesce((entry->>'allow_finish_customization')::boolean,false),'manual_curated',pins,override_role,override_w,override_d,override_h)
    ON CONFLICT(furniture_package_id,board_item_id) WHERE furniture_package_id IS NOT NULL AND board_item_id IS NOT NULL DO UPDATE SET project_studio_item_id=coalesce(EXCLUDED.project_studio_item_id,public.hotspot_slot_rules.project_studio_item_id),is_swappable=EXCLUDED.is_swappable,allow_finish_customization=EXCLUDED.allow_finish_customization,selection_mode='manual_curated',pinned_alternative_ids=EXCLUDED.pinned_alternative_ids,category_role_override=EXCLUDED.category_role_override,width_m_override=EXCLUDED.width_m_override,depth_m_override=EXCLUDED.depth_m_override,height_m_override=EXCLUDED.height_m_override;
  END LOOP;
  RETURN public.get_package_hotspot_configuration(_project_id,_package_id);
END $$;
REVOKE ALL ON FUNCTION public.save_package_hotspot_configuration(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_package_hotspot_configuration(uuid,uuid,jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_viewing_room_choices(_token text,_package_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE data jsonb; p public.furniture_packages; items jsonb; source_project_id uuid;
BEGIN
  data:=public.get_viewing_room_package(_token,_package_id); IF data IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.furniture_packages WHERE id=_package_id;
  SELECT d.project_id INTO source_project_id FROM public.residence_layouts l JOIN public.developer_projects d ON d.id=l.developer_project_id WHERE l.id=p.residence_layout_id;
  SELECT jsonb_agg(j || jsonb_build_object('retail_price',CASE WHEN p.currency='EUR' THEN (public._shared_board_retail_price(t.rrp_price_cents,t.size_variants,i.variant_label)->>'cents')::numeric/100 ELSE NULL END,'retail_price_from',coalesce((public._shared_board_retail_price(t.rrp_price_cents,t.size_variants,i.variant_label)->>'from')::boolean,false),'allow_finish_customization',coalesce(r.allow_finish_customization,true),'is_swappable',p.allow_alternatives AND coalesce(r.is_swappable,true),'alternatives',CASE WHEN NOT p.allow_alternatives OR r.is_swappable=false THEN '[]'::jsonb WHEN r.id IS NOT NULL THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'product_name',c.name,'category',c.category_role,'subcategory',NULL,'image_url',alt.image_url,'dimensions',concat(c.width_m,' × ',c.depth_m,' × ',c.height_m,' m'),'width_mm',c.width_m*1000,'depth_mm',c.depth_m*1000,'height_mm',c.height_m*1000,'glb_url',coalesce(c.glb_url_compressed,c.glb_url_proxy),'lead_time',CASE WHEN NULLIF(c.base_lead_time_weeks,0) IS NOT NULL THEN c.base_lead_time_weeks::text||' weeks' END,'materials','{}'::jsonb,'retail_price',NULLIF(c.base_price_sgd,0) * CASE WHEN p.currency='SGD' THEN 1 ELSE (SELECT rate FROM public.currency_rates WHERE base_currency='SGD' AND target_currency=p.currency ORDER BY rate_date DESC LIMIT 1) END,'retail_price_from',false) ORDER BY c.name) FROM public.catalog_items c LEFT JOIN public.trade_products alt ON alt.id=c.id WHERE c.id=ANY(r.pinned_alternative_ids) AND (original.id IS NULL OR c.id<>original.id) AND c.category_role=s.category_role AND s.width_m>0 AND s.depth_m>0 AND c.width_m BETWEEN s.width_m*0.85 AND s.width_m*1.15 AND c.depth_m BETWEEN s.depth_m*0.85 AND s.depth_m*1.15 AND coalesce(c.glb_url_compressed,c.glb_url_proxy) ~* '^https?://' AND (alt.id IS NULL OR (alt.is_active AND NOT coalesce(alt.is_hidden,false)))),'[]'::jsonb) ELSE coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.product_id,'product_name',alt.product_name,'category',alt.category,'subcategory',alt.subcategory,'image_url',alt.image_url,'dimensions',alt.dimensions,'width_mm',alt.width_mm,'depth_mm',alt.depth_mm,'height_mm',alt.height_mm,'glb_url',coalesce((SELECT c.glb_url_compressed FROM public.catalog_items c WHERE c.id=alt.id),alt.glb_url),'lead_time',alt.lead_time,'materials','{}'::jsonb,'retail_price',a.retail_price,'retail_price_from',a.retail_price_from) ORDER BY a.sort_order,alt.product_name) FROM public.viewing_room_slot_alternatives a JOIN public.trade_products alt ON alt.id=a.product_id WHERE a.package_id=p.id AND a.slot_id=i.id AND alt.is_active AND NOT coalesce(alt.is_hidden,false) AND coalesce((SELECT c.glb_url_compressed FROM public.catalog_items c WHERE c.id=alt.id),alt.glb_url) ~* '^https?://[^[:space:]]+\.(glb|gltf|obj)([?#].*)?$'),'[]'::jsonb) END)) INTO items
  FROM jsonb_array_elements(data->'items') j
  JOIN public.client_board_items i ON i.id=(j->>'id')::uuid
  JOIN public.trade_products t ON t.id=i.product_id
  LEFT JOIN public.hotspot_slot_rules r ON r.furniture_package_id=p.id AND r.board_item_id=i.id
  LEFT JOIN public.project_studio_items psi ON psi.board_item_id=i.id AND psi.project_id=source_project_id
  LEFT JOIN public.catalog_items original ON original.id=psi.catalog_item_id
  CROSS JOIN LATERAL (SELECT coalesce(r.category_role_override,original.category_role) AS category_role,coalesce(r.width_m_override,original.width_m) AS width_m,coalesce(r.depth_m_override,original.depth_m) AS depth_m) s;
  RETURN jsonb_build_object('items',coalesce(items,'[]'::jsonb),'allow_alternatives',p.allow_alternatives);
END $$;