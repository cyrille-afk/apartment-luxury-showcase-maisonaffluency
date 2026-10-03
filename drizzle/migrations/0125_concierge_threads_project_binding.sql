ALTER TABLE public.concierge_threads ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.concierge_threads ADD COLUMN IF NOT EXISTS workspace boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS concierge_threads_user_project_idx ON public.concierge_threads (user_id, project_id, last_active_at DESC);