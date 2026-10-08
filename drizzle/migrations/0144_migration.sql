CREATE OR REPLACE FUNCTION public.set_curator_pick_slug()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE base_slug text; candidate text; n int := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = ''
     OR (TG_OP = 'UPDATE' AND NEW.slug ~ '^untitled-piece(-[0-9]+)?$'
         AND NEW.title IS DISTINCT FROM OLD.title
         AND coalesce(NEW.title,'') !~* '^untitled piece$') THEN
    base_slug := public.compute_curator_pick_slug(NEW.title, NEW.subtitle);
    IF base_slug = '' THEN base_slug := public.slugify_text(NEW.title); END IF;
    candidate := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.designer_curator_picks
      WHERE designer_id = NEW.designer_id AND slug = candidate AND id <> NEW.id) LOOP
      n := n + 1; candidate := base_slug || '-' || n::text;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.designer_curator_picks SET slug = NULL
WHERE slug ~ '^untitled-piece(-[0-9]+)?$' AND title !~* '^untitled piece$';