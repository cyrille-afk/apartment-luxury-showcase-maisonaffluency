
-- Presentation shares table
CREATE TABLE public.presentation_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  shared_with_email text NOT NULL,
  shared_with_user_id uuid,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (presentation_id, shared_with_email)
);

-- Presentation comments table
CREATE TABLE public.presentation_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  slide_id uuid REFERENCES public.presentation_slides(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.presentation_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_comments ENABLE ROW LEVEL SECURITY;

-- Shares: admins manage, shared users can read their own shares
CREATE POLICY "Admins can manage presentation shares" ON public.presentation_shares
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shared users can view own shares" ON public.presentation_shares
  FOR SELECT TO authenticated
  USING (shared_with_user_id = auth.uid());

-- Comments: admins full access, shared users can insert and read
CREATE POLICY "Admins can manage presentation comments" ON public.presentation_comments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shared users can read presentation comments" ON public.presentation_comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.presentation_shares
    WHERE presentation_shares.presentation_id = presentation_comments.presentation_id
    AND presentation_shares.shared_with_user_id = auth.uid()
  ));

CREATE POLICY "Shared users can insert comments" ON public.presentation_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.presentation_shares
      WHERE presentation_shares.presentation_id = presentation_comments.presentation_id
      AND presentation_shares.shared_with_user_id = auth.uid()
    )
  );

-- Allow shared users to view the presentation itself
CREATE POLICY "Shared users can view shared presentations" ON public.presentations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.presentation_shares
    WHERE presentation_shares.presentation_id = presentations.id
    AND presentation_shares.shared_with_user_id = auth.uid()
  ));

-- Allow shared users to view slides of shared presentations
CREATE POLICY "Shared users can view shared presentation slides" ON public.presentation_slides
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.presentation_shares
    WHERE presentation_shares.presentation_id = presentation_slides.presentation_id
    AND presentation_shares.shared_with_user_id = auth.uid()
  ));

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.presentation_comments;
