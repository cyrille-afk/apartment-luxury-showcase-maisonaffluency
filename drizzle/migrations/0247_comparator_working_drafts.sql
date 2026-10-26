CREATE TABLE public.comparator_working_drafts (
  user_id uuid NOT NULL,
  draft_key text NOT NULL,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, draft_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comparator_working_drafts TO authenticated;
GRANT ALL ON public.comparator_working_drafts TO service_role;
ALTER TABLE public.comparator_working_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own comparator drafts" ON public.comparator_working_drafts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());