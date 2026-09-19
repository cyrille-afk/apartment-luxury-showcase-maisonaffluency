
CREATE OR REPLACE FUNCTION public.log_unauthorized_access(
  _route text,
  _details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_events (event_type, source, user_id, details)
  VALUES (
    'unauthorized_access',
    'client',
    auth.uid(),
    jsonb_build_object('route', _route) || COALESCE(_details, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_unauthorized_access(text, jsonb) TO authenticated, anon;
