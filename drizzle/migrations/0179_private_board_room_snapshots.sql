CREATE TABLE public.board_visualiser_scenes (board_id uuid PRIMARY KEY REFERENCES public.client_boards(id) ON DELETE CASCADE, scene jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.board_visualiser_scenes TO authenticated;
GRANT ALL ON public.board_visualiser_scenes TO service_role;
ALTER TABLE public.board_visualiser_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Board editors read room snapshots" ON public.board_visualiser_scenes FOR SELECT TO authenticated USING (public.can_manage_board(board_id));
CREATE POLICY "Board editors publish room snapshots" ON public.board_visualiser_scenes FOR INSERT TO authenticated WITH CHECK (public.can_manage_board(board_id));
CREATE OR REPLACE FUNCTION public._room_json_fields(_value jsonb,_keys text[]) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $f$ SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(CASE WHEN jsonb_typeof(_value)='object' THEN _value ELSE '{}'::jsonb END) WHERE key=ANY(_keys); $f$;
REVOKE ALL ON FUNCTION public._room_json_fields(jsonb,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public._room_json_fields(jsonb,text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_visualiser_room_board(_title text,_client_id uuid,_project_id uuid,_studio_id uuid,_studio_name text,_studio_logo_url text,_hide_maison_branding boolean,_items jsonb,_scene jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $f$
DECLARE b uuid; o jsonb; clean jsonb; objs jsonb := '[]'; parts jsonb; pair record; mat text; vec text; n jsonb; idx integer:=0; itemid uuid;
BEGIN
 IF jsonb_typeof(_scene) IS DISTINCT FROM 'object' OR octet_length(_scene::text)>8000000 OR jsonb_typeof(_scene->'objects') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid room'; END IF;
 IF jsonb_array_length(_scene->'objects') NOT BETWEEN 1 AND 15 OR jsonb_array_length(_scene->'objects')<>jsonb_array_length(_items) THEN RAISE EXCEPTION 'Room pieces do not match selection'; END IF;
 b:=public.create_visualiser_client_board(_title,_client_id,_project_id,_studio_id,_studio_name,_studio_logo_url,_hide_maison_branding,_items);
 FOR o IN SELECT value FROM jsonb_array_elements(_scene->'objects') LOOP
  IF o->>'id' IS DISTINCT FROM _items->idx->>'product_id' OR coalesce(o->>'instanceId','')='' THEN RAISE EXCEPTION 'Invalid room piece'; END IF;
  FOR vec IN SELECT unnest(ARRAY['position','rotation']) LOOP
   IF jsonb_typeof(o->vec) IS DISTINCT FROM 'array' OR jsonb_array_length(o->vec)<>3 THEN RAISE EXCEPTION 'Invalid placement'; END IF;
   FOR n IN SELECT value FROM jsonb_array_elements(o->vec) LOOP IF jsonb_typeof(n)<>'number' OR abs((n::text)::numeric)>1000 THEN RAISE EXCEPTION 'Invalid placement'; END IF; END LOOP;
  END LOOP;
  IF jsonb_typeof(o->'scale') IS DISTINCT FROM 'number' OR (o->>'scale')::numeric NOT BETWEEN 0.01 AND 100 THEN RAISE EXCEPTION 'Invalid scale'; END IF;
  SELECT id INTO itemid FROM public.client_board_items WHERE board_id=b AND sort_order=idx;
  clean:=public._room_json_fields(o,ARRAY['id','instanceId','product_name','brand_name','image_url','dimensions','width_mm','depth_mm','height_mm','glb_url','position','rotation','scale','modelOrientation']);
  clean:=clean||jsonb_build_object('boardItemId',itemid,'marbleSurface',public._room_json_fields(o->'marbleSurface',ARRAY['reflectivity','roughness']));
  FOR mat IN SELECT unnest(ARRAY['material','topMaterial','baseMaterial','upholsteryMaterial']) LOOP
   IF jsonb_typeof(o->mat)='object' THEN clean:=clean||jsonb_build_object(mat,public._room_json_fields(o->mat,ARRAY['id','name','brand_name','category','material_type','color_family','image_url','diffuse_url','normal_url','roughness_url','target','color','repeat','roughness','metalness'])); END IF;
  END LOOP;
  parts:='{}';
  FOR pair IN SELECT key,value FROM jsonb_each(CASE WHEN jsonb_typeof(o->'partMaterials')='object' THEN o->'partMaterials' ELSE '{}' END) LOOP parts:=parts||jsonb_build_object(pair.key,public._room_json_fields(pair.value,ARRAY['id','name','brand_name','category','material_type','color_family','image_url','diffuse_url','normal_url','roughness_url','target','color','repeat','roughness','metalness'])); END LOOP;
  clean:=clean||jsonb_build_object('partMaterials',parts);
  objs:=objs||jsonb_build_array(clean); idx:=idx+1;
 END LOOP;
 IF (SELECT count(DISTINCT x->>'instanceId') FROM jsonb_array_elements(objs) x)<>idx THEN RAISE EXCEPTION 'Duplicate room instance'; END IF;
 clean:=public._room_json_fields(_scene,ARRAY['floorFinish','showRearWall','wallHeight','ceilingHeight','ceilingThickness','ceilingOpening','floorGlare','wallColor','wallFinish','wallCustomHex','wallFinishIntensity','featureWallFinish','rugColor','rugBorderColor','rugBorderThicknessMm','rugBorderTwistMm','rugBorderRoughness','rugWeave','rugPile','rugWidth','rugDepth','rugOffsetX','rugOffsetZ','rugRotation','showRug','backdropDataUrl','backdropColor','backdropBrightness','depthOfField','dofStrength','dofFocusSelected','environmentSource']);
 clean:=clean||jsonb_build_object('version',1,'objects',objs,'advancedRendering',public._room_json_fields(_scene->'advancedRendering',ARRAY['shadowSharpness','contrastIntensity','contactShadowIntensity']));
 INSERT INTO public.board_visualiser_scenes(board_id,scene) VALUES(b,clean);
 RETURN b;
END $f$;
REVOKE ALL ON FUNCTION public.create_visualiser_room_board(text,uuid,uuid,uuid,text,text,boolean,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_visualiser_room_board(text,uuid,uuid,uuid,text,text,boolean,jsonb,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_shared_board_scene(_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $f$
DECLARE inv public.board_invites;
BEGIN
 inv:=public._board_invite_by_token(_token);
 IF inv.id IS NULL THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.board_guest_sessions WHERE invite_id=inv.id AND expires_at>now() AND token_hash=encode(extensions.digest(coalesce(_token,''),'sha256'),'hex')) THEN RETURN NULL; END IF;
 RETURN (SELECT scene FROM public.board_visualiser_scenes WHERE board_id=inv.board_id);
END $f$;
REVOKE ALL ON FUNCTION public.get_shared_board_scene(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_board_scene(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.approve_shared_room(_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE inv public.board_invites; it record;
BEGIN
 inv:=public._board_invite_by_token(_token);
 IF inv.id IS NULL OR inv.role<>'client' OR public.get_shared_board_scene(_token) IS NULL THEN RAISE EXCEPTION 'Verified client access required'; END IF;
 FOR it IN SELECT bi.id FROM public.client_board_items bi JOIN public.board_visualiser_scenes s ON s.board_id=bi.board_id WHERE bi.board_id=inv.board_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.scene->'objects') o WHERE o->>'boardItemId'=bi.id::text) LOOP
  IF EXISTS(SELECT 1 FROM public.board_item_feedback WHERE item_id=it.id AND invite_id=inv.id AND comment LIKE 'Finish request: %') THEN RAISE EXCEPTION 'Review proposed finishes individually before room approval'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.board_item_feedback WHERE item_id=it.id AND invite_id=inv.id AND reaction='heart') THEN PERFORM public.submit_board_feedback(_token,it.id,'heart',NULL); END IF;
 END LOOP;
END $f$;
REVOKE ALL ON FUNCTION public.approve_shared_room(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_shared_room(text) TO anon,authenticated;