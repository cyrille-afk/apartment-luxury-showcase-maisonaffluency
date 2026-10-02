CREATE TABLE public.curation_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New curation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.curation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.curation_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  route text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX curation_threads_user_idx ON public.curation_threads(user_id, updated_at DESC);
CREATE INDEX curation_messages_thread_idx ON public.curation_messages(thread_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curation_threads TO authenticated;
GRANT ALL ON public.curation_threads TO service_role;
GRANT SELECT, DELETE ON public.curation_messages TO authenticated;
GRANT ALL ON public.curation_messages TO service_role;

ALTER TABLE public.curation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own curation threads" ON public.curation_threads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Read own curation messages" ON public.curation_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Delete own curation messages" ON public.curation_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());