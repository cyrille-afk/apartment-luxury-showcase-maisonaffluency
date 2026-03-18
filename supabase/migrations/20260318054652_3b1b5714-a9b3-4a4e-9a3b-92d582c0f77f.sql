
-- Audit log for sample request status changes
CREATE TABLE public.sample_request_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES trade_sample_requests(id) ON DELETE CASCADE,
  changed_by uuid,
  old_status text,
  new_status text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: admins can read
ALTER TABLE public.sample_request_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.sample_request_audit_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert audit log"
  ON public.sample_request_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger function to log status changes and update updated_at
CREATE OR REPLACE FUNCTION public.log_sample_request_status_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO sample_request_audit_log (request_id, changed_by, old_status, new_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sample_request_audit
  BEFORE UPDATE ON trade_sample_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_sample_request_status_change();

-- Seed initial audit entry for existing requests
INSERT INTO sample_request_audit_log (request_id, old_status, new_status, notes, created_at)
SELECT id, NULL, status, 'Initial state (pre-audit)', created_at
FROM trade_sample_requests;
