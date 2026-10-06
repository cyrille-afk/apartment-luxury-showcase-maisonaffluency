CREATE OR REPLACE FUNCTION public.notify_studio_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name text;
  company_name text;
  base_payload jsonb;
BEGIN
  -- Fire only when the NDA flag flips from false/NULL to true.
  IF NOT (NEW.has_accepted_trade_nda IS TRUE AND COALESCE(OLD.has_accepted_trade_nda, false) IS NOT TRUE) THEN
    RETURN NEW;
  END IF;

  user_name := NULLIF(trim(BOTH ' ' FROM concat_ws(' ', NEW.first_name, NEW.last_name)), '');
  company_name := NULLIF(trim(BOTH ' ' FROM COALESCE(NEW.company, '')), '');

  base_payload := jsonb_build_object(
    'templateName', 'studio-activation-alert',
    'templateData', jsonb_build_object(
      'userName', COALESCE(user_name, 'A trade member'),
      'companyName', COALESCE(company_name, 'their studio')
    )
  );

  PERFORM net.http_post(
    url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/send-transactional-email',
    body := base_payload || jsonb_build_object(
      'recipientEmail', 'cyrille@maisonaffluency.com',
      'idempotencyKey', 'studio-activation-' || NEW.id::text || '-cyrille'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcmF1aXlnYWV6b2R1d2RqbXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Nzg2NjIsImV4cCI6MjA4MDI1NDY2Mn0.COYGvxExzTLk0cZorF3KCJ2tzpIzvqTGb9Gb3J6wqsE'
    ),
    timeout_milliseconds := 5000
  );

  PERFORM net.http_post(
    url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/send-transactional-email',
    body := base_payload || jsonb_build_object(
      'recipientEmail', 'concierge@maisonaffluency.com',
      'idempotencyKey', 'studio-activation-' || NEW.id::text || '-concierge'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcmF1aXlnYWV6b2R1d2RqbXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Nzg2NjIsImV4cCI6MjA4MDI1NDY2Mn0.COYGvxExzTLk0cZorF3KCJ2tzpIzvqTGb9Gb3J6wqsE'
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_studio_activation ON public.profiles;
CREATE TRIGGER trg_notify_studio_activation
AFTER UPDATE OF has_accepted_trade_nda ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_studio_activation();