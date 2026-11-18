CREATE TABLE public.viewing_room_slot_alternatives (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.furniture_packages(id) ON DELETE CASCADE, slot_id uuid NOT NULL REFERENCES public.client_board_items(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.trade_products(id), retail_price numeric NOT NULL CHECK(retail_price>0), sort_order int NOT NULL DEFAULT 0, UNIQUE(package_id,slot_id,product_id));
REVOKE ALL ON public.viewing_room_slot_alternatives FROM anon,authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON public.viewing_room_slot_alternatives TO authenticated; GRANT ALL ON public.viewing_room_slot_alternatives TO service_role;
ALTER TABLE public.viewing_room_slot_alternatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_choices ON public.viewing_room_slot_alternatives FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin') AND EXISTS(SELECT 1 FROM public.furniture_packages p JOIN public.client_board_items i ON i.board_id=p.moodboard_id WHERE p.id=package_id AND i.id=slot_id));
CREATE TABLE public.viewing_room_proposal_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.furniture_packages(id) ON DELETE CASCADE, request_key uuid NOT NULL UNIQUE, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.viewing_room_proposal_requests FROM anon,authenticated; GRANT SELECT ON public.viewing_room_proposal_requests TO authenticated; GRANT ALL ON public.viewing_room_proposal_requests TO service_role;
ALTER TABLE public.viewing_room_proposal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_requests ON public.viewing_room_proposal_requests FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.get_viewing_room_choices(_token text,_package_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE data jsonb; p public.furniture_packages; items jsonb;
BEGIN
 data:=public.get_viewing_room_package(_token,_package_id); IF data IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO p FROM public.furniture_packages WHERE id=_package_id;
 SELECT jsonb_agg(j || jsonb_build_object('retail_price',CASE WHEN p.currency='EUR' THEN (public._shared_board_retail_price(t.rrp_price_cents,t.size_variants,i.variant_label)->>'cents')::numeric/100 ELSE NULL END,'alternatives',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.product_id,'product_name',alt.product_name,'category',alt.category,'subcategory',alt.subcategory,'image_url',alt.image_url,'dimensions',alt.dimensions,'width_mm',alt.width_mm,'depth_mm',alt.depth_mm,'height_mm',alt.height_mm,'glb_url',alt.glb_url,'lead_time',alt.lead_time,'materials','{}'::jsonb,'retail_price',a.retail_price) ORDER BY a.sort_order) FROM public.viewing_room_slot_alternatives a JOIN public.trade_products alt ON alt.id=a.product_id WHERE a.package_id=p.id AND a.slot_id=i.id AND alt.glb_url IS NOT NULL),'[]'::jsonb))) INTO items FROM jsonb_array_elements(data->'items') j JOIN public.client_board_items i ON i.id=(j->>'id')::uuid JOIN public.trade_products t ON t.id=i.product_id;
 RETURN jsonb_build_object('items',coalesce(items,'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.get_viewing_room_choices(text,uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.get_viewing_room_choices(text,uuid) TO anon,authenticated;
CREATE FUNCTION public.lock_viewing_room_proposal(_token text,_package_id uuid,_choices jsonb,_request_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE data jsonb; p public.furniture_packages; slot jsonb; choice jsonb; selected jsonb; lines jsonb:='[]'; total numeric; result jsonb; request_id uuid;
BEGIN
 data:=public.get_viewing_room_choices(_token,_package_id); IF data IS NULL THEN RAISE EXCEPTION 'Viewing room unavailable'; END IF;
 SELECT * INTO p FROM public.furniture_packages WHERE id=_package_id;
 IF jsonb_typeof(_choices) IS DISTINCT FROM 'array' OR jsonb_array_length(_choices)<>jsonb_array_length(data->'items') THEN RAISE EXCEPTION 'Choose every slot'; END IF;
 SELECT snapshot INTO result FROM public.viewing_room_proposal_requests WHERE request_key=_request_key AND package_id=p.id; IF result IS NOT NULL THEN RETURN result; END IF;
 total:=p.package_price;
 FOR slot IN SELECT value FROM jsonb_array_elements(data->'items') LOOP
 IF (SELECT count(*) FROM jsonb_array_elements(_choices) c WHERE c->>'slot_id'=slot->>'id')<>1 THEN RAISE EXCEPTION 'Invalid slot'; END IF;
 SELECT c INTO choice FROM jsonb_array_elements(_choices) c WHERE c->>'slot_id'=slot->>'id'; selected:=slot-'alternatives';
 IF choice->>'product_id' IS DISTINCT FROM slot->>'id' THEN
 SELECT a INTO selected FROM jsonb_array_elements(slot->'alternatives') a WHERE a->>'id'=choice->>'product_id';
 IF selected IS NULL OR slot->>'retail_price' IS NULL THEN RAISE EXCEPTION 'Unapproved choice'; END IF;
 total:=total+(selected->>'retail_price')::numeric-(slot->>'retail_price')::numeric;
 END IF;
 lines:=lines||jsonb_build_array(selected||jsonb_build_object('slot_id',slot->>'id'));
 END LOOP;
 result:=jsonb_build_object('package',p.tier_name,'currency',p.currency,'total',total,'items',lines,'status','requested');
 INSERT INTO public.viewing_room_proposal_requests(package_id,request_key,snapshot) VALUES(p.id,_request_key,result) ON CONFLICT(request_key) DO NOTHING RETURNING id INTO request_id;
 IF request_id IS NULL THEN SELECT snapshot INTO result FROM public.viewing_room_proposal_requests WHERE request_key=_request_key AND package_id=p.id; IF result IS NULL THEN RAISE EXCEPTION 'Request unavailable'; END IF; END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.lock_viewing_room_proposal(text,uuid,jsonb,uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.lock_viewing_room_proposal(text,uuid,jsonb,uuid) TO anon,authenticated;