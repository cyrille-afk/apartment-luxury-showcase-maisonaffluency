-- Notify all admins when a custom request is created or updated by a non-admin
CREATE OR REPLACE FUNCTION public.notify_admins_custom_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  notif_title text;
  notif_message text;
  notif_type text;
  actor uuid := auth.uid();
  link_url text := '/trade/custom-requests';
  product_label text := COALESCE(NEW.product_name, 'a product');
BEGIN
  -- Skip if the actor is an admin (avoid self-notifying admin replies/status changes)
  IF actor IS NOT NULL AND has_role(actor, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    notif_title := 'New custom request';
    notif_message := 'A new bespoke request was submitted for ' || product_label || '.';
    notif_type := 'custom_request_new';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only notify if substantive fields changed
    IF NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.dimension_changes IS DISTINCT FROM OLD.dimension_changes
       OR NEW.finish_notes IS DISTINCT FROM OLD.finish_notes
       OR NEW.com_col_fabric IS DISTINCT FROM OLD.com_col_fabric
       OR NEW.com_yardage_meters IS DISTINCT FROM OLD.com_yardage_meters
       OR NEW.quantity IS DISTINCT FROM OLD.quantity
       OR NEW.target_lead_weeks IS DISTINCT FROM OLD.target_lead_weeks
       OR NEW.budget_notes IS DISTINCT FROM OLD.budget_notes THEN
      notif_title := 'Custom request updated';
      notif_message := 'A trade user updated their request for ' || product_label || '.';
      notif_type := 'custom_request_updated';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Insert one notification per admin
  FOR admin_id IN
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'::app_role
  LOOP
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (admin_id, notif_title, notif_message, link_url, notif_type);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_custom_request_ins ON public.trade_custom_requests;
DROP TRIGGER IF EXISTS trg_notify_admins_custom_request_upd ON public.trade_custom_requests;

CREATE TRIGGER trg_notify_admins_custom_request_ins
AFTER INSERT ON public.trade_custom_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_custom_request();

CREATE TRIGGER trg_notify_admins_custom_request_upd
AFTER UPDATE ON public.trade_custom_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_custom_request();