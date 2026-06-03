
CREATE TABLE public.brief_drafts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brief_drafts TO authenticated;
GRANT ALL ON public.brief_drafts TO service_role;

ALTER TABLE public.brief_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own brief draft"
  ON public.brief_drafts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own brief draft"
  ON public.brief_drafts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own brief draft"
  ON public.brief_drafts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own brief draft"
  ON public.brief_drafts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
