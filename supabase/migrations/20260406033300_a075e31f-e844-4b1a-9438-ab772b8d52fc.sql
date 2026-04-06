
-- Table to store annotation sessions (one per image)
CREATE TABLE public.markup_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  image_url TEXT NOT NULL,
  pins JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.markup_annotations ENABLE ROW LEVEL SECURITY;

-- Users can manage their own annotations
CREATE POLICY "Users can manage own annotations"
  ON public.markup_annotations FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can view all annotations
CREATE POLICY "Admins can view all annotations"
  ON public.markup_annotations FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
