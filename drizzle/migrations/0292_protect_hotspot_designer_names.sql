CREATE OR REPLACE FUNCTION public._hotspot_public_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id
  FROM public.gallery_hotspots h
  WHERE public._hotspot_mapped_pick_public(h.mapped_pick_id)
    AND (
      h.designer_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.designers d
        WHERE d.id = h.designer_id
          AND COALESCE(d.is_published, false) = true
          AND COALESCE(d.trade_only, false) = false
      )
    )
    AND (
      h.designer_name IS NULL
      OR public._norm_designer_name(h.designer_name) IS NULL
      OR public._norm_designer_name(h.designer_name) <> ALL (
        COALESCE((SELECT public._hotspot_blocked_designer_names()), '{}'::text[])
      )
    );
$$;

REVOKE ALL ON FUNCTION public._hotspot_public_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._hotspot_public_ids() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public._hotspot_blocked_designer_names() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._hotspot_blocked_designer_names() TO service_role;

DROP POLICY IF EXISTS "Public can read hotspots for public content" ON public.gallery_hotspots;
CREATE POLICY "Public can read hotspots for public content"
ON public.gallery_hotspots
FOR SELECT
TO anon, authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR gallery_hotspots.id IN (SELECT public._hotspot_public_ids())
);