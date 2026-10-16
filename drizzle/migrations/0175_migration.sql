CREATE OR REPLACE FUNCTION public.set_curator_pick_slug()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE base_slug text; candidate text; n int := 1; full_slug text;
BEGIN
  full_slug := public.compute_curator_pick_slug(NEW.title, NEW.subtitle);
  IF NEW.slug IS NULL OR NEW.slug = ''
     OR (TG_OP = 'UPDATE' AND NEW.slug ~ '^untitled-piece(-[0-9]+)?$'
         AND NEW.title IS DISTINCT FROM OLD.title
         AND coalesce(NEW.title,'') !~* '^untitled piece$')
     -- Ambiguous/truncated slugs (single letter, or a cut-off "untitled-piec…")
     -- collide across designers and make product pages show the wrong item.
     OR (NEW.slug ~ '^([a-z0-9]{1,2}|untitled-piec[a-z]?)(-[0-9]+)?$'
         AND length(full_slug) > 2 AND NEW.slug <> full_slug
         AND NEW.slug !~ ('^' || full_slug || '(-[0-9]+)?$')) THEN
    IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
      RAISE WARNING 'curator pick %: ambiguous slug "%" replaced by "%"', NEW.id, NEW.slug, full_slug;
    END IF;
    base_slug := full_slug;
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

CREATE OR REPLACE VIEW public.curator_pick_slug_audit WITH (security_invoker = true) AS
SELECT p.id, p.title, p.slug, d.slug AS designer_slug,
  CASE WHEN p.slug ~ '^([a-z0-9]{1,2}|untitled-piec[a-z]?)(-[0-9]+)?$' AND p.title !~* '^untitled piece$' THEN 'truncated'
       ELSE 'duplicate_in_designer' END AS issue
FROM public.designer_curator_picks p JOIN public.designers d ON d.id = p.designer_id
WHERE (p.slug ~ '^([a-z0-9]{1,2}|untitled-piec[a-z]?)(-[0-9]+)?$' AND p.title !~* '^untitled piece$')
   OR EXISTS (SELECT 1 FROM public.designer_curator_picks o WHERE o.designer_id = p.designer_id AND o.slug = p.slug AND o.id <> p.id);
REVOKE ALL ON public.curator_pick_slug_audit FROM anon;
GRANT SELECT ON public.curator_pick_slug_audit TO authenticated, service_role;