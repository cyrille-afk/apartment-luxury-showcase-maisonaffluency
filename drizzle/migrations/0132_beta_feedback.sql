CREATE TABLE public.beta_feedback_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  lane text NOT NULL CHECK (lane IN ('bug_hunt','workflow','copilot')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  observations text CHECK (char_length(observations) <= 5000),
  screenshot_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.beta_feedback_entries TO authenticated;
GRANT ALL ON public.beta_feedback_entries TO service_role;
ALTER TABLE public.beta_feedback_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beta feedback read" ON public.beta_feedback_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "beta feedback insert" ON public.beta_feedback_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "beta feedback delete" ON public.beta_feedback_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "beta shots upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='beta-feedback' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "beta shots read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='beta-feedback' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));