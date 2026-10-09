ALTER TABLE public.video_render_jobs
  ADD COLUMN IF NOT EXISTS render_seconds numeric,
  ADD COLUMN IF NOT EXISTS cost_usd numeric;