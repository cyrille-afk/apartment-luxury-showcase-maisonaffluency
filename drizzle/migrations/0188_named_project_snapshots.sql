CREATE TABLE public.project_layout_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 project_key text NOT NULL CHECK (length(project_key) BETWEEN 1 AND 200),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 data jsonb NOT NULL CHECK (jsonb_typeof(data->'scene'->'objects') = 'array' AND data->>'version' = '1'),
 piece_count integer NOT NULL CHECK (piece_count >= 0),
 thumbnail text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.project_layout_snapshots TO authenticated;
GRANT ALL ON public.project_layout_snapshots TO service_role;
ALTER TABLE public.project_layout_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their snapshots" ON public.project_layout_snapshots FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners save snapshots" ON public.project_layout_snapshots FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners delete snapshots" ON public.project_layout_snapshots FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX project_layout_snapshots_owner_project_time ON public.project_layout_snapshots (user_id, project_key, created_at DESC);
COMMENT ON TABLE public.project_layout_snapshots IS 'Immutable owner-private named project layout and finish checkpoints. New saves never overwrite earlier versions.';