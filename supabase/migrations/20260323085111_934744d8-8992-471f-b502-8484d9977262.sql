-- Immutable audit log for designer_curator_picks and trade_documents changes
CREATE TABLE public.content_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,
  record_id uuid NOT NULL,
  changed_by uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_audit_table_time ON public.content_audit_log (table_name, created_at DESC);
CREATE INDEX idx_content_audit_record ON public.content_audit_log (record_id);

ALTER TABLE public.content_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.content_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.log_curator_picks_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data)
    VALUES ('designer_curator_picks', 'DELETE', OLD.id, auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data, new_data)
    VALUES ('designer_curator_picks', 'UPDATE', NEW.id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, new_data)
    VALUES ('designer_curator_picks', 'INSERT', NEW.id, auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_trade_documents_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data)
    VALUES ('trade_documents', 'DELETE', OLD.id, auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data, new_data)
    VALUES ('trade_documents', 'UPDATE', NEW.id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, new_data)
    VALUES ('trade_documents', 'INSERT', NEW.id, auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_curator_picks
  AFTER INSERT OR UPDATE OR DELETE ON public.designer_curator_picks
  FOR EACH ROW EXECUTE FUNCTION public.log_curator_picks_change();

CREATE TRIGGER trg_audit_trade_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.trade_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_trade_documents_change();