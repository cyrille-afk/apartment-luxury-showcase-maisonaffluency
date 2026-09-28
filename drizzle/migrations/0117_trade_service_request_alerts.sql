CREATE OR REPLACE FUNCTION public.alert_trade_service_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  mid text;
  html text;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  SELECT DISTINCT ur.user_id, 'trade_service_request',
    'New trade services request',
    NEW.first_name || ' ' || NEW.last_name || ' (' || NEW.company_name || ') — ' || NEW.service_type,
    '/trade/admin/service-requests',
    jsonb_build_object('request_id', NEW.id)
  FROM public.user_roles ur WHERE ur.role IN ('admin','super_admin');

  html := '<div style="font-family:Georgia,serif;color:#1a1a1a"><h2>New Trade Services Request</h2>'
    || '<p><b>' || replace(replace(NEW.first_name || ' ' || NEW.last_name,'<','&lt;'),'>','&gt;') || '</b> — '
    || replace(replace(NEW.company_name,'<','&lt;'),'>','&gt;') || '</p>'
    || '<p>Service: ' || replace(NEW.service_type,'<','&lt;') || '<br>Country: ' || replace(NEW.country,'<','&lt;')
    || '<br>Contact via: ' || NEW.preferred_contact || '<br>Email: ' || replace(NEW.email,'<','&lt;')
    || '<br>Phone: ' || replace(NEW.phone,'<','&lt;') || '</p>'
    || '<p><a href="https://www.maisonaffluency.com/trade/admin/service-requests">Review in admin</a></p></div>';

  FOR r IN SELECT DISTINCT p.email FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
           WHERE ur.role IN ('admin','super_admin') AND p.email IS NOT NULL LOOP
    mid := 'trade-service-' || NEW.id || '-' || split_part(r.email,'@',1);
    BEGIN
      PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
        'to', r.email,
        'from', 'Maison Affluency Trade <trade@notify.www.maisonaffluency.com>',
        'sender_domain', 'notify.www.maisonaffluency.com',
        'subject', 'New trade services request — ' || NEW.company_name,
        'html', html, 'purpose', 'transactional', 'label', 'trade-service-request',
        'message_id', mid, 'idempotency_key', mid, 'queued_at', now()));
      INSERT INTO public.email_send_log (message_id, template_name, recipient_email, status)
      VALUES (mid, 'trade-service-request', r.email, 'pending');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'trade service alert email failed: %', SQLERRM;
    END;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_alert_trade_service_request
AFTER INSERT ON public.trade_service_requests
FOR EACH ROW EXECUTE FUNCTION public.alert_trade_service_request();

CREATE INDEX IF NOT EXISTS idx_trade_service_requests_created ON public.trade_service_requests (created_at DESC);