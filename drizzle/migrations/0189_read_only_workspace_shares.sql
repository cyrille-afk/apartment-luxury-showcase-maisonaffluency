CREATE TABLE public.project_workspace_shares (board_id uuid PRIMARY KEY REFERENCES public.client_boards(id) ON DELETE CASCADE, user_id uuid NOT NULL DEFAULT auth.uid(), project_key text NOT NULL, presentation jsonb NOT NULL, revoked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.project_workspace_shares TO authenticated;
GRANT ALL ON public.project_workspace_shares TO service_role;
ALTER TABLE public.project_workspace_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_owner_read ON public.project_workspace_shares FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.workspace_safe_scene(s jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE o jsonb; c jsonb; m text; p record; objs jsonb:='[]'; parts jsonb;
BEGIN
FOR o IN SELECT value FROM jsonb_array_elements(s->'objects') LOOP
c:=public._room_json_fields(o,ARRAY['id','instanceId','product_name','brand_name','image_url','dimensions','glb_url','position','rotation','scale','width_mm','depth_mm','height_mm','modelOrientation','marbleSurface']);
FOR m IN SELECT unnest(ARRAY['material','topMaterial','baseMaterial','upholsteryMaterial']) LOOP
IF jsonb_typeof(o->m)='object' THEN c:=c||jsonb_build_object(m,public._room_json_fields(o->m,ARRAY['id','name','brand_name','category','material_type','color_family','image_url','diffuse_url','normal_url','roughness_url','target','color','repeat','roughness','metalness'])); END IF;
END LOOP;
parts:='{}'; FOR p IN SELECT key,value FROM jsonb_each(CASE WHEN jsonb_typeof(o->'partMaterials')='object' THEN o->'partMaterials' ELSE '{}' END) LOOP parts:=parts||jsonb_build_object(p.key,CASE WHEN jsonb_typeof(p.value)='object' THEN public._room_json_fields(p.value,ARRAY['id','name','brand_name','category','material_type','color_family','image_url','diffuse_url','normal_url','roughness_url','target','color','repeat','roughness','metalness']) ELSE 'null'::jsonb END); END LOOP;
c:=c||jsonb_build_object('partMaterials',parts); objs:=objs||jsonb_build_array(c);
END LOOP;
RETURN public._room_json_fields(s,ARRAY['floorFinish','showRearWall','wallHeight','ceilingHeight','ceilingThickness','ceilingOpening','floorGlare','wallColor','wallFinish','wallCustomHex','wallFinishIntensity','featureWallFinish','rugColor','rugBorderColor','rugBorderThicknessMm','rugBorderTwistMm','rugBorderRoughness','rugWeave','rugPile','rugWidth','rugDepth','rugOffsetX','rugOffsetZ','rugRotation','showRug','backdropColor','backdropBrightness','backdropDataUrl','depthOfField','dofStrength','dofFocusSelected','environmentSource'])||jsonb_build_object('version',1,'objects',objs,'advancedRendering',public._room_json_fields(s->'advancedRendering',ARRAY['shadowSharpness','contrastIntensity','contactShadowIntensity']));
END $$;
REVOKE ALL ON FUNCTION public.workspace_safe_scene(jsonb) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.create_workspace_share(_project_key text,_title text,_floor_plan text,_snapshot_ids uuid[],_studio_name text,_studio_logo text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b uuid; views jsonb; n integer;
BEGIN
IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'trade_user') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN RAISE EXCEPTION 'Trade membership required'; END IF;
IF length(trim(_title)) NOT BETWEEN 1 AND 120 OR length(_project_key) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid project title'; END IF;
IF _floor_plan IS NOT NULL AND (_floor_plan !~ '^https://' OR length(_floor_plan)>10000) THEN RAISE EXCEPTION 'Use an uploaded floor plan'; END IF;
IF cardinality(_snapshot_ids)>20 OR cardinality(_snapshot_ids)<> (SELECT count(DISTINCT x) FROM unnest(_snapshot_ids) x) THEN RAISE EXCEPTION 'Select up to 20 distinct views'; END IF;
SELECT count(*), coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'created_at',created_at,'bounds',public._room_json_fields(data->'bounds',ARRAY['width','depth','height']),'floorPlanUrl',data->'floorPlanUrl','scene',public.workspace_safe_scene(data->'scene')) ORDER BY created_at DESC),'[]'::jsonb) INTO n,views FROM public.project_layout_snapshots WHERE user_id=auth.uid() AND project_key=_project_key AND id=ANY(_snapshot_ids);
IF n<>coalesce(cardinality(_snapshot_ids),0) OR (n=0 AND _floor_plan IS NULL) THEN RAISE EXCEPTION 'Select your saved views or upload a floor plan'; END IF;
IF octet_length(views::text)>24000000 THEN RAISE EXCEPTION 'Selection is too large; share fewer views'; END IF;
INSERT INTO public.client_boards(user_id,title,studio_name,studio_logo_url,hide_maison_branding,source) VALUES(auth.uid(),trim(_title),nullif(left(trim(_studio_name),120),''),nullif(_studio_logo,''),true,'manual') RETURNING id INTO b;
INSERT INTO public.project_workspace_shares(board_id,user_id,project_key,presentation) VALUES(b,auth.uid(),_project_key,jsonb_build_object('title',trim(_title),'studioName',left(_studio_name,120),'studioLogo',_studio_logo,'floorPlanUrl',_floor_plan,'views',views));
RETURN b;
END $$;
REVOKE ALL ON FUNCTION public.create_workspace_share(text,text,text,uuid[],text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_workspace_share(text,text,text,uuid[],text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_shared_workspace(_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv public.board_invites;
BEGIN inv:=public._board_invite_by_token(_token); IF inv.id IS NULL THEN RETURN NULL; END IF;
RETURN (SELECT presentation FROM public.project_workspace_shares WHERE board_id=inv.board_id AND NOT revoked);
END $$;
REVOKE ALL ON FUNCTION public.get_shared_workspace(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_workspace(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.workspace_read_only_items() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.project_workspace_shares WHERE board_id=NEW.board_id) THEN RAISE EXCEPTION 'Workspace presentations are read-only'; END IF; RETURN NEW; END $$;
CREATE TRIGGER workspace_no_item_writes BEFORE INSERT OR UPDATE ON public.client_board_items FOR EACH ROW EXECUTE FUNCTION public.workspace_read_only_items();
CREATE OR REPLACE FUNCTION public.workspace_client_invites_only() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.project_workspace_shares WHERE board_id=NEW.board_id) AND NEW.role<>'client' THEN RAISE EXCEPTION 'Workspace presentations allow clients only'; END IF; RETURN NEW; END $$;
CREATE TRIGGER workspace_client_invites_only BEFORE INSERT OR UPDATE ON public.board_invites FOR EACH ROW EXECUTE FUNCTION public.workspace_client_invites_only();
CREATE OR REPLACE FUNCTION public.revoke_workspace_share(_board_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.project_workspace_shares WHERE board_id=_board_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Owner access required'; END IF; UPDATE public.project_workspace_shares SET revoked=true WHERE board_id=_board_id; UPDATE public.board_invites SET status='revoked' WHERE board_id=_board_id; END $$;
REVOKE ALL ON FUNCTION public.revoke_workspace_share(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.revoke_workspace_share(uuid) TO authenticated;