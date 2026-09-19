-- Studio submissions inbox for the public "Submit your studio" form
CREATE TABLE public.studio_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  instagram TEXT,
  location TEXT,
  country TEXT,
  disciplines TEXT[] NOT NULL DEFAULT '{}',
  project_types TEXT[] NOT NULL DEFAULT '{}',
  portfolio_url TEXT,
  about TEXT,
  notable_projects TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  user_id UUID,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous public visitors) can submit
CREATE POLICY "Anyone can submit a studio"
  ON public.studio_submissions
  FOR INSERT
  WITH CHECK (true);

-- Only admins can view / manage submissions
CREATE POLICY "Admins can view submissions"
  ON public.studio_submissions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update submissions"
  ON public.studio_submissions
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete submissions"
  ON public.studio_submissions
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Reuse the standard updated_at trigger
CREATE TRIGGER update_studio_submissions_updated_at
BEFORE UPDATE ON public.studio_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_studio_submissions_created_at
  ON public.studio_submissions (created_at DESC);
CREATE INDEX idx_studio_submissions_status
  ON public.studio_submissions (status);