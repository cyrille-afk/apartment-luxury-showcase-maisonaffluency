
-- Function to notify admins when a new user registers
CREATE OR REPLACE FUNCTION public.notify_admins_new_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Insert a bell notification for every admin/super_admin
  FOR admin_record IN
    SELECT DISTINCT ur.user_id
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'super_admin')
      AND ur.user_id != NEW.id  -- don't notify the user themselves
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

  RETURN NEW;
END;
$$;

-- Trigger after profile creation (which happens on signup via handle_new_user)
CREATE TRIGGER on_new_profile_notify_admins
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_registration();
