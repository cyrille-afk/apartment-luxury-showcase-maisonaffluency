
CREATE OR REPLACE FUNCTION public.log_designers_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data)
    VALUES ('designers', 'DELETE', OLD.id, auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data, new_data)
    VALUES ('designers', 'UPDATE', NEW.id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, new_data)
    VALUES ('designers', 'INSERT', NEW.id, auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_designers
  AFTER INSERT OR UPDATE OR DELETE ON public.designers
  FOR EACH ROW EXECUTE FUNCTION public.log_designers_change();
