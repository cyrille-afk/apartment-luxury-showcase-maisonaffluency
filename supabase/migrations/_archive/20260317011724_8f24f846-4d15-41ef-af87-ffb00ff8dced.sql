-- Update has_role: super_admin implies admin (use text cast to avoid compile-time enum check)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    CASE
      WHEN _user_id = auth.uid() THEN
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = _user_id AND (
            role = _role
            OR (role::text = 'super_admin' AND _role::text = 'admin')
          )
        )
      ELSE false
    END
  );
END;
$function$;