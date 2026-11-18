CREATE OR REPLACE FUNCTION public.get_viewing_room_personalization(_token text,_package_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE data jsonb; items jsonb;
BEGIN
 data:=public.get_viewing_room_choices(_token,_package_id); IF data IS NULL THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(j || jsonb_build_object('is_swappable',r.id IS NOT NULL AND coalesce(r.is_swappable,false) AND (data->>'allow_alternatives')::boolean,'allow_finish_customization',r.id IS NOT NULL AND coalesce(r.allow_finish_customization,false),'alternatives',CASE WHEN r.id IS NOT NULL AND r.is_swappable THEN j->'alternatives' ELSE '[]'::jsonb END)),'[]'::jsonb) INTO items FROM jsonb_array_elements(data->'items') j LEFT JOIN public.hotspot_slot_rules r ON r.furniture_package_id=_package_id AND r.board_item_id=(j->>'id')::uuid;
 RETURN jsonb_build_object('items',items,'allow_alternatives',data->'allow_alternatives');
END $$;
REVOKE ALL ON FUNCTION public.get_viewing_room_personalization(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viewing_room_personalization(text,uuid) TO anon,authenticated,service_role;