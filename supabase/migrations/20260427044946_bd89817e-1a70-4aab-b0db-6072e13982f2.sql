ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.notify_admins_custom_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_id uuid;
  notif_title text;
  notif_message text;
  notif_type text;
  actor uuid := auth.uid();
  link_url text := '/trade/custom-requests?focus=' || NEW.id::text;
  product_label text := COALESCE(NEW.product_name, 'a product');
  requester_name text;
  requester_company text;
  project_name text;
  project_location text;
  meta jsonb;
BEGIN
  IF actor IS NOT NULL AND has_role(actor, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    notif_title := 'New custom request';
    notif_type := 'custom_request_new';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.dimension_changes IS DISTINCT FROM OLD.dimension_changes
       OR NEW.finish_notes IS DISTINCT FROM OLD.finish_notes
       OR NEW.com_col_fabric IS DISTINCT FROM OLD.com_col_fabric
       OR NEW.com_yardage_meters IS DISTINCT FROM OLD.com_yardage_meters
       OR NEW.quantity IS DISTINCT FROM OLD.quantity
       OR NEW.target_lead_weeks IS DISTINCT FROM OLD.target_lead_weeks
       OR NEW.budget_notes IS DISTINCT FROM OLD.budget_notes THEN
      notif_title := 'Custom request updated';
      notif_type := 'custom_request_updated';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  SELECT TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), p.company
    INTO requester_name, requester_company
    FROM public.profiles p WHERE p.id = NEW.user_id;

  IF NEW.project_id IS NOT NULL THEN
    SELECT pr.name, pr.location
      INTO project_name, project_location
      FROM public.projects pr WHERE pr.id = NEW.project_id;
  END IF;

  notif_message :=
    COALESCE(NULLIF(requester_name, ''), 'A trade user')
    || ' • ' || product_label
    || COALESCE(' (' || NULLIF(NEW.brand_name, '') || ')', '')
    || COALESCE(' — ' || NULLIF(project_name, ''), '')
    || ' — status: ' || NEW.status;

  meta := jsonb_build_object(
    'request_id', NEW.id,
    'requester_name', COALESCE(requester_name, ''),
    'requester_company', COALESCE(requester_company, ''),
    'product_name', product_label,
    'brand_name', COALESCE(NEW.brand_name, ''),
    'project_name', COALESCE(project_name, ''),
    'project_location', COALESCE(project_location, ''),
    'status', NEW.status,
    'quantity', NEW.quantity,
    'action_label', 'Open request',
    'action_link', link_url
  );

  FOR admin_id IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'::app_role
  LOOP
    INSERT INTO public.notifications (user_id, title, message, link, type, metadata)
    VALUES (admin_id, notif_title, notif_message, link_url, notif_type, meta);
  END LOOP;

  RETURN NEW;
END;
$function$;