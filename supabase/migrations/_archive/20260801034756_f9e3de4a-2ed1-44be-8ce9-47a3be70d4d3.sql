CREATE OR REPLACE FUNCTION public.handle_new_trade_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
    email_domain TEXT;
    assigned_status TEXT;
BEGIN
    user_email := LOWER(NEW.email);
    email_domain := SUBSTRING(user_email FROM '@(.*)$');

    -- Only a VERIFIED address can be trusted to belong to the signer-up.
    -- Unverified signups always wait for manual review, otherwise anyone
    -- could type someone@architects.com and self-grant trade access.
    IF NEW.email_confirmed_at IS NULL THEN
        assigned_status := 'pending_review';
    ELSIF email_domain IN ('gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','hotmail.com','outlook.com','icloud.com','me.com','aol.com','live.com','proton.me','protonmail.com') THEN
        assigned_status := 'pending_review';
    ELSE
        assigned_status := 'approved';
    END IF;

    INSERT INTO public.profiles (id, email, trade_status)
    VALUES (NEW.id, user_email, assigned_status)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          -- never downgrade an admin-approved account
          trade_status = CASE
            WHEN public.profiles.trade_status = 'approved' THEN 'approved'
            ELSE EXCLUDED.trade_status
          END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_trade_signup ON auth.users;
CREATE TRIGGER on_trade_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_trade_signup();

DROP TRIGGER IF EXISTS on_trade_signup_confirmed ON auth.users;
CREATE TRIGGER on_trade_signup_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_trade_signup();