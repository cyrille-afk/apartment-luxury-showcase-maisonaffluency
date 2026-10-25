ALTER TABLE public.comparator_shortlists ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS comparator_shortlists_project_idx ON public.comparator_shortlists(user_id,project_id,created_at DESC);
CREATE OR REPLACE FUNCTION public.validate_comparator_shortlist_project() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.project_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.project_id IS DISTINCT FROM OLD.project_id) AND NOT public.can_edit_project(NEW.user_id,NEW.project_id) THEN RAISE EXCEPTION 'Project access required'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER comparator_shortlist_project_access BEFORE INSERT OR UPDATE ON public.comparator_shortlists FOR EACH ROW EXECUTE FUNCTION public.validate_comparator_shortlist_project();