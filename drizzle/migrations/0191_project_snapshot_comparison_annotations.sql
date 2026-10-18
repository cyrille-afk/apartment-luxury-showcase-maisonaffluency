CREATE TABLE public.project_snapshot_comparison_annotations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 project_key text NOT NULL,
 left_snapshot_id uuid NOT NULL REFERENCES public.project_layout_snapshots(id) ON DELETE CASCADE,
 right_snapshot_id uuid NOT NULL REFERENCES public.project_layout_snapshots(id) ON DELETE CASCADE,
 annotations jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, project_key, left_snapshot_id, right_snapshot_id),
 CONSTRAINT comparison_distinct_snapshots CHECK (left_snapshot_id <> right_snapshot_id),
 CONSTRAINT comparison_annotations_object CHECK (jsonb_typeof(annotations) = 'object' AND octet_length(annotations::text) <= 25165824)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_snapshot_comparison_annotations TO authenticated;
GRANT ALL ON public.project_snapshot_comparison_annotations TO service_role;
ALTER TABLE public.project_snapshot_comparison_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read comparison annotations" ON public.project_snapshot_comparison_annotations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners save comparison annotations" ON public.project_snapshot_comparison_annotations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.project_layout_snapshots s WHERE s.id = left_snapshot_id AND s.project_key = project_snapshot_comparison_annotations.project_key AND s.user_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.project_layout_snapshots s WHERE s.id = right_snapshot_id AND s.project_key = project_snapshot_comparison_annotations.project_key AND s.user_id = auth.uid()));
CREATE POLICY "Owners update comparison annotations" ON public.project_snapshot_comparison_annotations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.project_layout_snapshots s WHERE s.id = left_snapshot_id AND s.project_key = project_snapshot_comparison_annotations.project_key AND s.user_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.project_layout_snapshots s WHERE s.id = right_snapshot_id AND s.project_key = project_snapshot_comparison_annotations.project_key AND s.user_id = auth.uid()));
CREATE POLICY "Owners delete comparison annotations" ON public.project_snapshot_comparison_annotations FOR DELETE TO authenticated USING (user_id = auth.uid());