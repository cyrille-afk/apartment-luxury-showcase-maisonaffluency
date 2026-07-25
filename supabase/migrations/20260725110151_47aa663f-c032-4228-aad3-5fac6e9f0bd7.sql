
-- Tighten SELECT on designer_heritage_slides
DROP POLICY IF EXISTS "Anyone can view heritage slides" ON public.designer_heritage_slides;
CREATE POLICY "Public can view heritage slides for public designers"
ON public.designer_heritage_slides
FOR SELECT
TO anon, authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.designers d
    WHERE d.id = designer_heritage_slides.designer_id
      AND COALESCE(d.is_published, false) = true
      AND COALESCE(d.trade_only, false) = false
  )
);

-- Tighten SELECT on designer_instagram_posts
DROP POLICY IF EXISTS "Public can view non-hidden instagram posts" ON public.designer_instagram_posts;
CREATE POLICY "Public can view instagram posts for public designers"
ON public.designer_instagram_posts
FOR SELECT
TO anon, authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    COALESCE(hidden, false) = false
    AND EXISTS (
      SELECT 1 FROM public.designers d
      WHERE d.id = designer_instagram_posts.designer_id
        AND COALESCE(d.is_published, false) = true
        AND COALESCE(d.trade_only, false) = false
    )
  )
);

-- Tighten SELECT on gallery_hotspots
DROP POLICY IF EXISTS "Anyone can read gallery hotspots" ON public.gallery_hotspots;
CREATE POLICY "Public can read hotspots for public content"
ON public.gallery_hotspots
FOR SELECT
TO anon, authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    -- If linked to a curator pick, that pick must not be hidden and its designer must be public
    (
      gallery_hotspots.mapped_pick_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.designer_curator_picks p
        JOIN public.designers d ON d.id = p.designer_id
        WHERE p.id = gallery_hotspots.mapped_pick_id
          AND COALESCE(p.is_hidden, false) = false
          AND COALESCE(d.is_published, false) = true
          AND COALESCE(d.trade_only, false) = false
      )
    )
    -- If a designer_name is set, block hotspots whose named designer is trade-only or unpublished
    AND NOT EXISTS (
      SELECT 1 FROM public.designers d
      WHERE gallery_hotspots.designer_name IS NOT NULL
        AND lower(btrim(d.name)) = lower(btrim(gallery_hotspots.designer_name))
        AND (COALESCE(d.trade_only, false) = true OR COALESCE(d.is_published, false) = false)
    )
  )
);
