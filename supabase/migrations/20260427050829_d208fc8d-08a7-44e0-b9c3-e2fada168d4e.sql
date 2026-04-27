-- Activity log for Custom Requests
CREATE TABLE public.trade_custom_request_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.trade_custom_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_role text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_tcr_activity_request ON public.trade_custom_request_activity(request_id, created_at DESC);

ALTER TABLE public.trade_custom_request_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity"
ON public.trade_custom_request_activity
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Request owners can view own activity"
ON public.trade_custom_request_activity
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.trade_custom_requests r
  WHERE r.id = trade_custom_request_activity.request_id
    AND r.user_id = auth.uid()
));

-- Tracked fields function
CREATE OR REPLACE FUNCTION public.log_custom_request_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  arole text := 'trade_user';
  changed jsonb := '{}'::jsonb;
  act text;
BEGIN
  IF uid IS NOT NULL AND has_role(uid, 'admin'::app_role) THEN
    arole := 'admin';
  ELSIF uid IS NULL THEN
    arole := 'system';
  END IF;

  IF TG_OP = 'INSERT' THEN
    act := 'created';
    changed := jsonb_build_object(
      'product_name', NEW.product_name,
      'brand_name', NEW.brand_name,
      'status', NEW.status,
      'quantity', NEW.quantity
    );
  ELSIF TG_OP = 'UPDATE' THEN
    act := 'updated';
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      changed := changed || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      changed := changed || jsonb_build_object('admin_notes', jsonb_build_object('from', OLD.admin_notes, 'to', NEW.admin_notes));
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      changed := changed || jsonb_build_object('notes', jsonb_build_object('from', OLD.notes, 'to', NEW.notes));
    END IF;
    IF NEW.dimension_changes IS DISTINCT FROM OLD.dimension_changes THEN
      changed := changed || jsonb_build_object('dimension_changes', jsonb_build_object('from', OLD.dimension_changes, 'to', NEW.dimension_changes));
    END IF;
    IF NEW.finish_notes IS DISTINCT FROM OLD.finish_notes THEN
      changed := changed || jsonb_build_object('finish_notes', jsonb_build_object('from', OLD.finish_notes, 'to', NEW.finish_notes));
    END IF;
    IF NEW.com_col_fabric IS DISTINCT FROM OLD.com_col_fabric THEN
      changed := changed || jsonb_build_object('com_col_fabric', jsonb_build_object('from', OLD.com_col_fabric, 'to', NEW.com_col_fabric));
    END IF;
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      changed := changed || jsonb_build_object('quantity', jsonb_build_object('from', OLD.quantity, 'to', NEW.quantity));
    END IF;
    IF NEW.target_lead_weeks IS DISTINCT FROM OLD.target_lead_weeks THEN
      changed := changed || jsonb_build_object('target_lead_weeks', jsonb_build_object('from', OLD.target_lead_weeks, 'to', NEW.target_lead_weeks));
    END IF;
    IF NEW.budget_notes IS DISTINCT FROM OLD.budget_notes THEN
      changed := changed || jsonb_build_object('budget_notes', jsonb_build_object('from', OLD.budget_notes, 'to', NEW.budget_notes));
    END IF;
    -- No tracked fields changed → skip
    IF changed = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.trade_custom_request_activity (request_id, actor_id, actor_role, action, changes)
  VALUES (NEW.id, uid, arole, act, changed);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_custom_request_activity_ins
AFTER INSERT ON public.trade_custom_requests
FOR EACH ROW EXECUTE FUNCTION public.log_custom_request_activity();

CREATE TRIGGER trg_log_custom_request_activity_upd
AFTER UPDATE ON public.trade_custom_requests
FOR EACH ROW EXECUTE FUNCTION public.log_custom_request_activity();