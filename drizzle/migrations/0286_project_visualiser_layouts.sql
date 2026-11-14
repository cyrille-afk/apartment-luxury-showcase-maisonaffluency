CREATE TABLE public.project_visualiser_layouts (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.project_visualiser_layouts TO authenticated;
GRANT ALL ON public.project_visualiser_layouts TO service_role;
ALTER TABLE public.project_visualiser_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View project layout" ON public.project_visualiser_layouts FOR SELECT TO authenticated USING (public.can_view_project(auth.uid(), project_id));
CREATE POLICY "Insert project layout" ON public.project_visualiser_layouts FOR INSERT TO authenticated WITH CHECK (public.can_edit_project(auth.uid(), project_id) AND updated_by = auth.uid());
CREATE POLICY "Update project layout" ON public.project_visualiser_layouts FOR UPDATE TO authenticated USING (public.can_edit_project(auth.uid(), project_id)) WITH CHECK (public.can_edit_project(auth.uid(), project_id) AND updated_by = auth.uid());