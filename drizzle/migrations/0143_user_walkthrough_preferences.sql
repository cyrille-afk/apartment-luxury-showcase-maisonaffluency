CREATE TABLE public.user_walkthrough_preferences (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  preset text NOT NULL DEFAULT 'sweep' CHECK (preset IN ('sweep','slow-orbit','furniture-tour')),
  custom_path_id text CHECK (custom_path_id IS NULL OR char_length(custom_path_id) <= 64),
  speed numeric NOT NULL DEFAULT 1 CHECK (speed IN (0.5, 0.75, 1, 1.5, 2)),
  loop boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_walkthrough_preferences TO authenticated;
GRANT ALL ON public.user_walkthrough_preferences TO service_role;
ALTER TABLE public.user_walkthrough_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage walkthrough preferences" ON public.user_walkthrough_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());