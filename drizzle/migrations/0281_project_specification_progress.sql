CREATE TABLE public.project_specification_progress (
 project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 stage text NOT NULL CHECK (stage IN ('mood-board','comparator','annotation','visualiser','tearsheet','specification-sheet','ffe-schedule','quote')),
 completed_by uuid NOT NULL DEFAULT auth.uid(),
 completed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (project_id, stage)
);
GRANT SELECT, INSERT, DELETE ON public.project_specification_progress TO authenticated;
GRANT ALL ON public.project_specification_progress TO service_role;
ALTER TABLE public.project_specification_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View accessible project workflow" ON public.project_specification_progress FOR SELECT TO authenticated USING (public.can_view_project(auth.uid(), project_id));
CREATE POLICY "Complete editable project workflow" ON public.project_specification_progress FOR INSERT TO authenticated WITH CHECK (completed_by = auth.uid() AND public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "Reopen editable project workflow" ON public.project_specification_progress FOR DELETE TO authenticated USING (public.can_edit_project(auth.uid(), project_id));