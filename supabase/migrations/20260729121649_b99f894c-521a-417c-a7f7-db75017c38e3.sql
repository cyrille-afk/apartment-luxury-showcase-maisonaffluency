ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS style text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';