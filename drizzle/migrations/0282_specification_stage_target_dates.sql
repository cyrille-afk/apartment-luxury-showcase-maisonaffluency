CREATE TABLE public.project_specification_targets (
 project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 stage text NOT NULL CHECK (stage IN ('mood-board','comparator','annotation','visualiser','tearsheet','specification-sheet','ffe-schedule','quote')),
 target_date date NOT NULL,
 PRIMARY KEY (project_id, stage)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_specification_targets TO authenticated;
GRANT ALL ON public.project_specification_targets TO service_role;
ALTER TABLE public.project_specification_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View accessible project stage targets" ON public.project_specification_targets FOR SELECT TO authenticated USING (public.can_view_project(auth.uid(), project_id));
CREATE POLICY "Set editable project stage targets" ON public.project_specification_targets FOR INSERT TO authenticated WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "Change editable project stage targets" ON public.project_specification_targets FOR UPDATE TO authenticated USING (public.can_edit_project(auth.uid(), project_id)) WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "Clear editable project stage targets" ON public.project_specification_targets FOR DELETE TO authenticated USING (public.can_edit_project(auth.uid(), project_id));