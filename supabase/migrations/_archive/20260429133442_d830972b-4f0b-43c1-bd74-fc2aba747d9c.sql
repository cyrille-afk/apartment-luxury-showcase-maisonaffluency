ALTER TABLE public.studio_submissions
  ADD CONSTRAINT studio_submissions_status_check
  CHECK (status IN ('new', 'reviewed', 'approved', 'rejected'));