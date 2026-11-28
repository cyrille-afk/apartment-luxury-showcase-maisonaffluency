ALTER TABLE public.residence_layouts ADD COLUMN eye_level_shell_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE public.viewing_room_visualizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.furniture_packages(id) ON DELETE CASCADE,
 credential_hash text NOT NULL, selection_signature text NOT NULL, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending', image_url text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.viewing_room_visualizations TO service_role;
ALTER TABLE public.viewing_room_visualizations ENABLE ROW LEVEL SECURITY;
CREATE INDEX viewing_room_visualizations_access_time ON public.viewing_room_visualizations(credential_hash, created_at);
CREATE FUNCTION public.queue_viewing_room_visualization(_package_id uuid, _credential_hash text, _selection_signature text, _payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(_credential_hash,0));
 IF EXISTS (SELECT 1 FROM public.viewing_room_visualizations WHERE credential_hash=_credential_hash AND status IN ('pending','running') AND created_at > now()-interval '5 minutes') THEN RAISE EXCEPTION 'Visualization already running'; END IF;
 IF (SELECT count(*) FROM public.viewing_room_visualizations WHERE credential_hash=_credential_hash AND created_at > now()-interval '1 hour') >= 5 THEN RAISE EXCEPTION 'Visualization limit reached'; END IF;
 INSERT INTO public.viewing_room_visualizations(package_id,credential_hash,selection_signature,payload) VALUES (_package_id,_credential_hash,_selection_signature,_payload) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.queue_viewing_room_visualization(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_viewing_room_visualization(uuid,text,text,jsonb) TO service_role;