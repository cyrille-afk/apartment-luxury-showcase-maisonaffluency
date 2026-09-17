ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;