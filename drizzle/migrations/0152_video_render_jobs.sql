CREATE TABLE public.video_render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'queued',
  video_url TEXT,
  failure TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_render_jobs TO authenticated;
GRANT ALL ON public.video_render_jobs TO service_role;
ALTER TABLE public.video_render_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own video renders" ON public.video_render_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX video_render_jobs_user_created ON public.video_render_jobs (user_id, created_at DESC);