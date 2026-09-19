-- Restrict public reads on designer_instagram_posts to non-hidden rows
DROP POLICY IF EXISTS "Anyone can view instagram posts" ON public.designer_instagram_posts;

CREATE POLICY "Public can view non-hidden instagram posts"
ON public.designer_instagram_posts
FOR SELECT
TO anon, authenticated
USING (COALESCE(hidden, false) = false OR public.has_role(auth.uid(), 'admin'));
