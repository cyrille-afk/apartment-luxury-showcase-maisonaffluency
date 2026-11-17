CREATE TABLE public.developer_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 developer_name text NOT NULL CHECK (length(btrim(developer_name)) > 0),
 developer_logo_url text,
 hero_image_url text,
 access_token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_projects TO authenticated;
GRANT ALL ON public.developer_projects TO service_role;
ALTER TABLE public.developer_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY developer_projects_admin ON public.developer_projects FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.residence_layouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 developer_project_id uuid NOT NULL REFERENCES public.developer_projects(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(btrim(name)) > 0),
 floorplan_url text,
 specs_label text,
 room_environment_glb text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.residence_layouts TO authenticated;
GRANT ALL ON public.residence_layouts TO service_role;
ALTER TABLE public.residence_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY residence_layouts_admin ON public.residence_layouts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.furniture_packages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 residence_layout_id uuid NOT NULL REFERENCES public.residence_layouts(id) ON DELETE CASCADE,
 moodboard_id uuid NOT NULL REFERENCES public.client_boards(id) ON DELETE RESTRICT,
 tier_name text NOT NULL CHECK (length(btrim(tier_name)) > 0),
 package_price numeric(14,2) NOT NULL CHECK (package_price >= 0),
 currency text NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR','USD','SGD','GBP','CHF')),
 description text NOT NULL DEFAULT '',
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (residence_layout_id, moodboard_id),
 UNIQUE (residence_layout_id, tier_name)
);
GRANT SELECT ON public.furniture_packages TO authenticated;
GRANT ALL ON public.furniture_packages TO service_role;
ALTER TABLE public.furniture_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY furniture_packages_admin ON public.furniture_packages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX developer_projects_project_idx ON public.developer_projects(project_id);
CREATE INDEX residence_layouts_developer_idx ON public.residence_layouts(developer_project_id);
CREATE OR REPLACE FUNCTION public.validate_viewing_room_package() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.residence_layouts r JOIN public.developer_projects d ON d.id=r.developer_project_id JOIN public.client_boards b ON b.id=NEW.moodboard_id AND b.project_id=d.project_id WHERE r.id=NEW.residence_layout_id) THEN
 RAISE EXCEPTION 'Package moodboard must belong to the linked project';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER validate_viewing_room_package BEFORE INSERT OR UPDATE ON public.furniture_packages FOR EACH ROW EXECUTE FUNCTION public.validate_viewing_room_package();
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
 INSERT INTO public.furniture_packages(residence_layout_id,moodboard_id,tier_name,package_price,currency,description,sort_order)
 SELECT _layout_id,(p->>'moodboard_id')::uuid,btrim(p->>'tier_name'),(p->>'package_price')::numeric,p->>'currency',coalesce(p->>'description',''),(ordinality-1)::integer FROM jsonb_array_elements(_packages) WITH ORDINALITY AS t(p,ordinality);
 RETURN QUERY SELECT * FROM public.furniture_packages WHERE residence_layout_id=_layout_id ORDER BY sort_order;
END;
$$;
REVOKE ALL ON FUNCTION public.save_viewing_room_packages(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_viewing_room_packages(uuid,jsonb) TO authenticated;
COMMENT ON COLUMN public.developer_projects.access_token IS 'Private reserved viewing-room access token; no anonymous table access or public redemption is enabled.';