CREATE OR REPLACE FUNCTION public._hotspot_mapped_pick_public(_pick_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _pick_id IS NULL OR EXISTS (
    SELECT 1
    FROM public.designer_curator_picks p
    JOIN public.designers d ON d.id = p.designer_id
    WHERE p.id = _pick_id
      AND COALESCE(p.is_hidden, false) = false
      AND COALESCE(d.is_published, false) = true
      AND COALESCE(d.trade_only, false) = false
  );
$$;

CREATE OR REPLACE FUNCTION public._hotspot_designer_public(_designer_id uuid, _designer_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      _designer_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.designers d
        WHERE d.id = _designer_id
          AND COALESCE(d.is_published, false) = true
          AND COALESCE(d.trade_only, false) = false
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.designers d
      WHERE _designer_name IS NOT NULL
        AND (
          public._norm_designer_name(d.name) = public._norm_designer_name(_designer_name)
          OR public._norm_designer_name(d.display_name) = public._norm_designer_name(_designer_name)
        )
        AND (COALESCE(d.trade_only, false) = true OR COALESCE(d.is_published, false) = false)
    );
$$;

GRANT EXECUTE ON FUNCTION public._hotspot_mapped_pick_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._hotspot_designer_public(uuid, text) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read hotspots for public content" ON public.gallery_hotspots;

CREATE POLICY "Public can read hotspots for public content"
ON public.gallery_hotspots
FOR SELECT
TO anon, authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    public._hotspot_mapped_pick_public(mapped_pick_id)
    AND public._hotspot_designer_public(designer_id, designer_name)
  )
);