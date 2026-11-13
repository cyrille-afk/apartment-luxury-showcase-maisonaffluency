ALTER TABLE public.ai_curated_layouts ADD COLUMN IF NOT EXISTS project_id uuid;
CREATE INDEX IF NOT EXISTS ai_curated_layouts_project_idx ON public.ai_curated_layouts (project_id, updated_at DESC);