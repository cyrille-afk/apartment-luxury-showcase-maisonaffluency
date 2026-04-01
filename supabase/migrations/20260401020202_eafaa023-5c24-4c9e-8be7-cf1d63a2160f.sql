
CREATE TABLE public.designer_instagram_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  designer_id UUID NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  post_url TEXT NOT NULL,
  caption TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.designer_instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage instagram posts"
  ON public.designer_instagram_posts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view instagram posts"
  ON public.designer_instagram_posts
  FOR SELECT
  TO public
  USING (true);

CREATE INDEX idx_designer_instagram_posts_designer_id ON public.designer_instagram_posts(designer_id);
