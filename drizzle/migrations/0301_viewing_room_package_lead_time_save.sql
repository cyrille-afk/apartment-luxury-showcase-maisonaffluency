CREATE OR REPLACE FUNCTION public.save_viewing_room_packages(_layout_id uuid, _packages jsonb) RETURNS SETOF public.furniture_packages LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _project uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF jsonb_typeof(_packages) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Packages must be an array'; END IF;
 IF jsonb_array_length(_packages) < 3 OR jsonb_array_length(_packages) > 5 THEN RAISE EXCEPTION 'Assign between 3 and 5 packages'; END IF;
 SELECT d.project_id INTO _project FROM public.residence_layouts r JOIN public.developer_projects d ON d.id=r.developer_project_id WHERE r.id=_layout_id FOR UPDATE OF r;
 IF _project IS NULL THEN RAISE EXCEPTION 'Residence layout not found'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(_packages) p WHERE NOT EXISTS (SELECT 1 FROM public.client_boards b WHERE b.id=(p->>'moodboard_id')::uuid AND b.project_id=_project)) THEN RAISE EXCEPTION 'Package moodboard must belong to the linked project'; END IF;
 DELETE FROM public.furniture_packages WHERE residence_layout_id=_layout_id;
 INSERT INTO public.furniture_packages(residence_layout_id,moodboard_id,tier_name,package_price,currency,description,sort_order,lead_time_weeks)
 SELECT _layout_id,(p->>'moodboard_id')::uuid,btrim(p->>'tier_name'),(p->>'package_price')::numeric,p->>'currency',coalesce(p->>'description',''),(ordinality-1)::integer,nullif(p->>'lead_time_weeks','')::integer FROM jsonb_array_elements(_packages) WITH ORDINALITY AS t(p,ordinality);
 RETURN QUERY SELECT * FROM public.furniture_packages WHERE residence_layout_id=_layout_id ORDER BY sort_order;
END; $$;
REVOKE ALL ON FUNCTION public.save_viewing_room_packages(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_viewing_room_packages(uuid,jsonb) TO authenticated;
COMMENT ON COLUMN public.developer_projects.access_token IS 'Private bearer link redeemed only by viewing-room projection functions; rotating this value revokes the old link.';