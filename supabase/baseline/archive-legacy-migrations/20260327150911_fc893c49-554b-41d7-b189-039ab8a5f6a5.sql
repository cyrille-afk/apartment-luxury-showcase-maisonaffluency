
-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enhanced trigger that also sends email notification via edge function
CREATE OR REPLACE FUNCTION public.notify_admins_new_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
  supabase_url text;
  service_key text;
BEGIN
  -- Insert a bell notification for every admin/super_admin
  FOR admin_record IN
    SELECT DISTINCT ur.user_id
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'super_admin')
      AND ur.user_id != NEW.id
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      admin_record.user_id,
      'New User Registration',
      'A new user has registered: ' || COALESCE(NEW.email, 'unknown'),
      'registration',
      '/trade/admin'
    );
  END LOOP;

  -- Send email notification via edge function
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := supabase_url || '/functions/v1/notify-new-registration',
      body := jsonb_build_object(
        'email', NEW.email,
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'company', NEW.company
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
