CREATE TABLE public.concierge_sessions (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.concierge_sessions TO authenticated;
GRANT ALL ON public.concierge_sessions TO service_role;

ALTER TABLE public.concierge_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own concierge session"
  ON public.concierge_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_concierge_sessions_updated_at
  BEFORE UPDATE ON public.concierge_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();