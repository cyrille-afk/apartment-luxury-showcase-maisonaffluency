
-- 1) Add FK column
ALTER TABLE public.gallery_hotspots
  ADD COLUMN IF NOT EXISTS designer_id uuid REFERENCES public.designers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gallery_hotspots_designer_id_idx
  ON public.gallery_hotspots(designer_id);

-- 2) Normalization helper: lowercase, strip punctuation, collapse whitespace
CREATE OR REPLACE FUNCTION public._norm_designer_name(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9]+', ' ', 'g'),
      '\s+', ' ', 'g'
    ),
    ''
  );
$$;

-- 3) Trigger to auto-resolve designer_id from designer_name at write time
CREATE OR REPLACE FUNCTION public.gallery_hotspots_resolve_designer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved uuid;
BEGIN
  IF NEW.designer_name IS NULL OR btrim(NEW.designer_name) = '' THEN
    NEW.designer_id := NULL;
    RETURN NEW;
  END IF;

  SELECT d.id INTO resolved
  FROM public.designers d
  WHERE public._norm_designer_name(d.name) = public._norm_designer_name(NEW.designer_name)
     OR public._norm_designer_name(d.display_name) = public._norm_designer_name(NEW.designer_name)
  ORDER BY d.is_published DESC NULLS LAST, d.created_at ASC
  LIMIT 1;

  NEW.designer_id := resolved;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gallery_hotspots_resolve_designer ON public.gallery_hotspots;
CREATE TRIGGER trg_gallery_hotspots_resolve_designer
  BEFORE INSERT OR UPDATE OF designer_name ON public.gallery_hotspots
  FOR EACH ROW
  EXECUTE FUNCTION public.gallery_hotspots_resolve_designer();

-- 4) Backfill existing rows
UPDATE public.gallery_hotspots gh
SET designer_id = d.id
FROM public.designers d
WHERE gh.designer_id IS NULL
  AND gh.designer_name IS NOT NULL
  AND (
    public._norm_designer_name(d.name) = public._norm_designer_name(gh.designer_name)
    OR public._norm_designer_name(d.display_name) = public._norm_designer_name(gh.designer_name)
  );

-- 5) Replace fragile SELECT policy with FK-driven check
DROP POLICY IF EXISTS "Public can read hotspots for public content" ON public.gallery_hotspots;

CREATE POLICY "Public can read hotspots for public content"
ON public.gallery_hotspots
FOR SELECT
TO anon, authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    -- Mapped pick, if present, must resolve to a public pick + published, non-trade-only designer
    (
      mapped_pick_id IS NULL
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
    AND
    -- Designer attribution (via FK) must be either absent OR a published, non-trade-only designer.
    -- Also block rows whose designer_name normalizes to a trade-only/unpublished designer
    -- even if the FK failed to resolve (safety net during any future name drift).
    (
      designer_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.designers d
        WHERE d.id = gallery_hotspots.designer_id
          AND COALESCE(d.is_published, false) = true
          AND COALESCE(d.trade_only, false) = false
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.designers d
      WHERE gallery_hotspots.designer_name IS NOT NULL
        AND (
          public._norm_designer_name(d.name) = public._norm_designer_name(gallery_hotspots.designer_name)
          OR public._norm_designer_name(d.display_name) = public._norm_designer_name(gallery_hotspots.designer_name)
        )
        AND (COALESCE(d.trade_only, false) = true OR COALESCE(d.is_published, false) = false)
    )
  )
);
