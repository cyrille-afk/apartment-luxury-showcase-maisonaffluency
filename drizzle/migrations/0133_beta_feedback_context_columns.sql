ALTER TABLE public.beta_feedback_entries
  ADD COLUMN author_name text,
  ADD COLUMN author_company text,
  ADD COLUMN viewport_tag text;