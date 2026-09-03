CREATE OR REPLACE FUNCTION public.sync_trade_access_on_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'trade_user'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles
       SET trade_status = 'approved'
     WHERE id = NEW.user_id;

    NEW.tax_exempt_status := TRUE;

  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'approved'
        AND NEW.status IN ('rejected', 'flagged', 'flagged_for_review', 'pending') THEN
    DELETE FROM public.user_roles
     WHERE user_id = NEW.user_id
       AND role = 'trade_user'::public.app_role;

    UPDATE public.profiles
       SET trade_status = CASE WHEN NEW.status = 'rejected' THEN 'rejected' ELSE 'pending_review' END
     WHERE id = NEW.user_id;

    NEW.tax_exempt_status := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_trade_access ON public.trade_applications;

CREATE TRIGGER trg_sync_trade_access
BEFORE INSERT OR UPDATE OF status ON public.trade_applications
FOR EACH ROW
EXECUTE FUNCTION public.sync_trade_access_on_status();