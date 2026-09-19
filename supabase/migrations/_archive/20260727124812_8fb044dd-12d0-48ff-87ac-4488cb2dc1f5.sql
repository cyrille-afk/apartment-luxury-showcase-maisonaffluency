CREATE TABLE public.concierge_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX concierge_threads_user_active_idx
  ON public.concierge_threads (user_id, last_active_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.concierge_threads TO authenticated;
GRANT ALL ON public.concierge_threads TO service_role;

ALTER TABLE public.concierge_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own concierge threads"
  ON public.concierge_threads
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_concierge_threads_updated_at
  BEFORE UPDATE ON public.concierge_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();