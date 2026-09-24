CREATE OR REPLACE FUNCTION public.guest_inquiries_wake_bridge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/bridge-guest-inquiries',
      headers := jsonb_build_object('Content-Type','application/json','x-internal-token', public._internal_job_token()),
      body := jsonb_build_object('guest_key', NEW.guest_key));
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block the guest insert
  END;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.guest_inquiries_wake_bridge() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guest_inquiries_wake_bridge
  AFTER INSERT ON public.guest_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.guest_inquiries_wake_bridge();