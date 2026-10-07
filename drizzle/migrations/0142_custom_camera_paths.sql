ALTER TABLE public.ai_curated_layouts ADD COLUMN IF NOT EXISTS camera_paths jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE public.user_saved_camera_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  mode text NOT NULL CHECK (mode IN ('capture','draw','text')),
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_camera_paths TO authenticated;
GRANT ALL ON public.user_saved_camera_paths TO service_role;
ALTER TABLE public.user_saved_camera_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their camera paths" ON public.user_saved_camera_paths
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX user_saved_camera_paths_user_idx ON public.user_saved_camera_paths(user_id, created_at DESC);