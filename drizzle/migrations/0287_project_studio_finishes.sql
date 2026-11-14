CREATE TABLE public.project_studio_finishes (project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE, item_key text NOT NULL, selection jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(selection) = 'object'), updated_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (project_id, item_key));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_studio_finishes TO authenticated;
GRANT ALL ON public.project_studio_finishes TO service_role;
ALTER TABLE public.project_studio_finishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View Studio finishes" ON public.project_studio_finishes FOR SELECT TO authenticated USING (public.can_view_project(auth.uid(), project_id));
CREATE POLICY "Insert Studio finishes" ON public.project_studio_finishes FOR INSERT TO authenticated WITH CHECK (public.can_edit_project(auth.uid(), project_id) AND updated_by = auth.uid());
CREATE POLICY "Update Studio finishes" ON public.project_studio_finishes FOR UPDATE TO authenticated USING (public.can_edit_project(auth.uid(), project_id)) WITH CHECK (public.can_edit_project(auth.uid(), project_id) AND updated_by = auth.uid());
CREATE POLICY "Delete Studio finishes" ON public.project_studio_finishes FOR DELETE TO authenticated USING (public.can_edit_project(auth.uid(), project_id));