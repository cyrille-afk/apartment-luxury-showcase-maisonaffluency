-- 1. Create the missing Mohaded × CC-Tapis collaboration designer.
INSERT INTO public.designers (slug, name, is_published, sort_order)
SELECT 'cristian-mohaded-cc-tapis', 'Cristián Mohaded', true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.designers WHERE slug = 'cristian-mohaded-cc-tapis');

-- 2. Reassign the existing Fold Small pick (and any other Mohaded × CC-Tapis pieces).
UPDATE public.designer_curator_picks p
SET designer_id = (SELECT id FROM public.designers WHERE slug = 'cristian-mohaded-cc-tapis')
FROM public.designers d
WHERE p.designer_id = d.id
  AND d.slug = 'cristian-mohaded'
  AND (p.title ILIKE '%cc-tapis%' OR p.title ILIKE '%cc tapis%' OR p.subtitle ILIKE '%cc-tapis%');

-- 3. Trigger function: auto-route picks whose copy mentions CC-Tapis to the
--    matching `<slug>-cc-tapis` collaboration profile when one exists.
CREATE OR REPLACE FUNCTION public.route_cc_tapis_pick_to_collab()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_slug text;
  target_id uuid;
BEGIN
  SELECT slug INTO current_slug FROM public.designers WHERE id = NEW.designer_id;
  IF current_slug IS NULL OR current_slug = 'cc-tapis' OR current_slug LIKE '%-cc-tapis' THEN
    RETURN NEW;
  END IF;

  IF NOT (
    COALESCE(NEW.title, '')    ILIKE '%cc-tapis%' OR
    COALESCE(NEW.title, '')    ILIKE '%cc tapis%' OR
    COALESCE(NEW.subtitle, '') ILIKE '%cc-tapis%' OR
    COALESCE(NEW.subtitle, '') ILIKE '%cc tapis%'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO target_id
  FROM public.designers
  WHERE slug = current_slug || '-cc-tapis';

  IF target_id IS NOT NULL THEN
    NEW.designer_id := target_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.route_cc_tapis_pick_to_collab() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_route_cc_tapis_pick ON public.designer_curator_picks;
CREATE TRIGGER trg_route_cc_tapis_pick
BEFORE INSERT OR UPDATE OF title, subtitle, designer_id
ON public.designer_curator_picks
FOR EACH ROW
EXECUTE FUNCTION public.route_cc_tapis_pick_to_collab();
