CREATE UNIQUE INDEX IF NOT EXISTS furniture_packages_id_layout_unique ON public.furniture_packages(id,residence_layout_id);
CREATE TABLE public.residence_room_renders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 residence_layout_id uuid NOT NULL REFERENCES public.residence_layouts(id),
 furniture_package_id uuid NOT NULL,
 room_name text NOT NULL CHECK (length(btrim(room_name)) BETWEEN 1 AND 120),
 room_type text NOT NULL CHECK (room_type IN ('living_room','dining_room','primary_bedroom','study','terrace','kitchen','bathroom','other')),
 shell_url text NOT NULL CHECK (shell_url LIKE 'https://%' AND length(shell_url)<=4096),
 render_url text CHECK (render_url LIKE 'https://%' AND length(render_url)<=4096),
 slot_ids uuid[] NOT NULL CHECK (cardinality(slot_ids) BETWEEN 1 AND 10),
 placement_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
 selection_signature text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (furniture_package_id,residence_layout_id) REFERENCES public.furniture_packages(id,residence_layout_id),
 UNIQUE (furniture_package_id,room_name)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.residence_room_renders TO authenticated;
GRANT ALL ON public.residence_room_renders TO service_role;
ALTER TABLE public.residence_room_renders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators manage room views" ON public.residence_room_renders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
COMMENT ON TABLE public.residence_room_renders IS 'Package-specific room images and explicit board-slot assignments. Buyer access only through verified private-room server functions.';