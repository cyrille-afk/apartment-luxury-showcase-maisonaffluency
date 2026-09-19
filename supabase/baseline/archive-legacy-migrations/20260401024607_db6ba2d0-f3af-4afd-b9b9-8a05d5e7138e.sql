UPDATE public.designer_instagram_posts
SET image_url = NULL
WHERE designer_id IN (
  SELECT id FROM public.designers WHERE slug = 'pierre-bonnefille'
);