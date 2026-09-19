ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS base_axis_label text,
  ADD COLUMN IF NOT EXISTS top_axis_label text;