ALTER TABLE public.furniture_packages ADD COLUMN allow_alternatives boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.get_viewing_room_board_summaries(_project_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',t.product_name,'image',t.image_url,'glb_url',coalesce(c.glb_url_compressed,t.glb_url),'price_cents',(public._shared_board_retail_price(t.rrp_price_cents,t.size_variants,i.variant_label)->>'cents')::numeric,'price_from',coalesce((public._shared_board_retail_price(t.rrp_price_cents,t.size_variants,i.variant_label)->>'from')::boolean,false)) ORDER BY i.sort_order) FROM public.client_board_items i LEFT JOIN public.trade_products t ON t.id=i.product_id LEFT JOIN public.catalog_items c ON c.id=t.id WHERE i.board_id=b.id AND NOT EXISTS(SELECT 1 FROM public.project_studio_finishes s WHERE s.project_id=_project_id AND s.item_key=i.id::text AND s.selection->>'excluded'='true')),'[]'::jsonb)) ORDER BY b.created_at) FROM public.client_boards b WHERE b.project_id=_project_id),'[]'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.get_viewing_room_board_summaries(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_viewing_room_board_summaries(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_viewing_room_packages(_layout_id uuid,_packages jsonb) RETURNS SETOF public.furniture_packages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _project uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF jsonb_typeof(_packages) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Packages must be an array'; END IF;
 IF jsonb_array_length(_packages)<3 OR jsonb_array_length(_packages)>5 THEN RAISE EXCEPTION 'Assign between 3 and 5 packages'; END IF;
 SELECT d.project_id INTO _project FROM public.residence_layouts r JOIN public.developer_projects d ON d.id=r.developer_project_id WHERE r.id=_layout_id FOR UPDATE OF r;
 IF _project IS NULL THEN RAISE EXCEPTION 'Residence layout not found'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_packages) p WHERE NOT EXISTS(SELECT 1 FROM public.client_boards b WHERE b.id=(p->>'moodboard_id')::uuid AND b.project_id=_project)) THEN RAISE EXCEPTION 'Package moodboard must belong to the linked project'; END IF;
 IF (SELECT count(DISTINCT p->>'moodboard_id') FROM jsonb_array_elements(_packages) p)<>jsonb_array_length(_packages) OR (SELECT count(DISTINCT btrim(p->>'tier_name')) FROM jsonb_array_elements(_packages) p)<>jsonb_array_length(_packages) THEN RAISE EXCEPTION 'Distinct boards and tiers required'; END IF;
 DELETE FROM public.furniture_packages WHERE residence_layout_id=_layout_id AND moodboard_id NOT IN(SELECT (p->>'moodboard_id')::uuid FROM jsonb_array_elements(_packages) p);
 UPDATE public.furniture_packages SET tier_name='draft-'||id::text WHERE residence_layout_id=_layout_id;
 INSERT INTO public.furniture_packages(residence_layout_id,moodboard_id,tier_name,package_price,currency,description,sort_order,lead_time_weeks,allow_alternatives)
 SELECT _layout_id,(p->>'moodboard_id')::uuid,btrim(p->>'tier_name'),(p->>'package_price')::numeric,p->>'currency',coalesce(p->>'description',''),(ordinality-1)::integer,nullif(p->>'lead_time_weeks','')::integer,coalesce((p->>'allow_alternatives')::boolean,true) FROM jsonb_array_elements(_packages) WITH ORDINALITY AS t(p,ordinality)
 ON CONFLICT(residence_layout_id,moodboard_id) DO UPDATE SET tier_name=excluded.tier_name,package_price=excluded.package_price,currency=excluded.currency,description=excluded.description,sort_order=excluded.sort_order,lead_time_weeks=excluded.lead_time_weeks,allow_alternatives=excluded.allow_alternatives;
 RETURN QUERY SELECT * FROM public.furniture_packages WHERE residence_layout_id=_layout_id ORDER BY sort_order;
END; $$;
REVOKE ALL ON FUNCTION public.save_viewing_room_packages(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_viewing_room_packages(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_viewing_room_choices(_token text,_package_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE data jsonb; p public.furniture_packages; items jsonb;
BEGIN
 data:=public.get_viewing_room_package(_token,_package_id); IF data IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO p FROM public.furniture_packages WHERE id=_package_id;
 SELECT jsonb_agg(j || jsonb_build_object('retail_price',CASE WHEN p.currency='EUR' THEN (public._shared_board_retail_price(t.rrp_price_cents,t.size_variants,i.variant_label)->>'cents')::numeric/100 ELSE NULL END,'retail_price_from',coalesce((public._shared_board_retail_price(t.rrp_price_cents,t.size_variants,i.variant_label)->>'from')::boolean,false),'alternatives',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.product_id,'product_name',alt.product_name,'category',alt.category,'subcategory',alt.subcategory,'image_url',alt.image_url,'dimensions',alt.dimensions,'width_mm',alt.width_mm,'depth_mm',alt.depth_mm,'height_mm',alt.height_mm,'glb_url',coalesce((SELECT c.glb_url_compressed FROM public.catalog_items c WHERE c.id=alt.id),alt.glb_url),'lead_time',alt.lead_time,'materials','{}'::jsonb,'retail_price',a.retail_price,'retail_price_from',a.retail_price_from) ORDER BY a.sort_order,alt.product_name) FROM public.viewing_room_slot_alternatives a JOIN public.trade_products alt ON alt.id=a.product_id WHERE p.allow_alternatives AND a.package_id=p.id AND a.slot_id=i.id AND alt.is_active AND NOT coalesce(alt.is_hidden,false) AND coalesce((SELECT c.glb_url_compressed FROM public.catalog_items c WHERE c.id=alt.id),alt.glb_url) ~* '^https?://[^[:space:]]+\.(glb|gltf|obj)([?#].*)?$'),'[]'::jsonb))) INTO items FROM jsonb_array_elements(data->'items') j JOIN public.client_board_items i ON i.id=(j->>'id')::uuid JOIN public.trade_products t ON t.id=i.product_id;
 RETURN jsonb_build_object('items',coalesce(items,'[]'::jsonb),'allow_alternatives',p.allow_alternatives);
END; $$;
REVOKE ALL ON FUNCTION public.get_viewing_room_choices(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viewing_room_choices(text,uuid) TO anon,authenticated;