CREATE TABLE public.quote_audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE, related_quote_id uuid REFERENCES public.trade_quotes(id) ON DELETE SET NULL, actor_id uuid NOT NULL, actor_name text NOT NULL, action text NOT NULL CHECK(action IN ('pricing_saved','changes_requested','revision_created')), occurred_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.quote_audit_events TO authenticated;
GRANT ALL ON public.quote_audit_events TO service_role;
ALTER TABLE public.quote_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY quote_audit_admin_read ON public.quote_audit_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX quote_audit_events_quote_time ON public.quote_audit_events(quote_id,occurred_at);
CREATE FUNCTION public.capture_quote_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); actor_label text;
BEGIN
 IF actor IS NULL THEN RETURN NEW; END IF;
 SELECT NULLIF(trim(concat_ws(' ',first_name,last_name)),'') INTO actor_label FROM public.profiles WHERE id=actor;
 actor_label:=COALESCE(actor_label,'Administrator');
 IF TG_OP='INSERT' THEN
  IF NEW.revision_of_quote_id IS NOT NULL AND public.has_role(actor,'admin') THEN
   INSERT INTO public.quote_audit_events(quote_id,related_quote_id,actor_id,actor_name,action) VALUES(NEW.revision_of_quote_id,NEW.id,actor,actor_label,'changes_requested'),(NEW.id,NEW.revision_of_quote_id,actor,actor_label,'revision_created');
  END IF;
 ELSE
  IF NEW.status='priced' AND public.has_role(actor,'admin') AND (OLD.status IS DISTINCT FROM NEW.status OR NEW.responded_at IS DISTINCT FROM OLD.responded_at) THEN
   INSERT INTO public.quote_audit_events(quote_id,actor_id,actor_name,action) VALUES(NEW.id,actor,actor_label,'pricing_saved');
  ELSIF NEW.status='draft' AND OLD.status IS DISTINCT FROM NEW.status THEN
   INSERT INTO public.quote_audit_events(quote_id,actor_id,actor_name,action) VALUES(NEW.id,actor,actor_label,'changes_requested');
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_quote_audit AFTER INSERT OR UPDATE ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.capture_quote_audit();
REVOKE ALL ON FUNCTION public.capture_quote_audit() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.admin_quote_audit_timeline(_quote_id uuid) RETURNS SETOF public.quote_audit_events LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH RECURSIVE ancestors AS (
  SELECT id,revision_of_quote_id FROM public.trade_quotes WHERE id=_quote_id AND public.has_role(auth.uid(),'admin')
  UNION SELECT q.id,q.revision_of_quote_id FROM public.trade_quotes q JOIN ancestors a ON q.id=a.revision_of_quote_id
 ), family AS (
  SELECT id FROM ancestors WHERE revision_of_quote_id IS NULL
  UNION SELECT q.id FROM public.trade_quotes q JOIN family f ON q.revision_of_quote_id=f.id
 ) SELECT e.* FROM public.quote_audit_events e WHERE e.quote_id IN (SELECT id FROM family) ORDER BY e.occurred_at DESC,e.id;
$$;
REVOKE ALL ON FUNCTION public.admin_quote_audit_timeline(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_quote_audit_timeline(uuid) TO authenticated;