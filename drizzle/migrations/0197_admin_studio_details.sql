CREATE OR REPLACE FUNCTION public.admin_studio_details(_studio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'studio', jsonb_build_object('id', s.id, 'name', s.name, 'display_name', s.display_name, 'billing_email', s.billing_email, 'created_at', s.created_at),
      'members', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', COALESCE(NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'Unknown'), 'email', p.email, 'role', m.role, 'joined_at', m.joined_at) ORDER BY CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END, m.joined_at, m.id) FROM public.studio_members m LEFT JOIN public.profiles p ON p.id = m.user_id WHERE m.studio_id = s.id), '[]'::jsonb),
      'invitations', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'role', i.role, 'created_at', i.created_at, 'expires_at', i.expires_at, 'expired', i.expires_at <= now()) ORDER BY i.created_at DESC, i.id) FROM public.studio_invites i WHERE i.studio_id = s.id AND i.accepted_at IS NULL), '[]'::jsonb)
    ) FROM public.studios s WHERE s.id = _studio_id
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_studio_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_studio_details(uuid) TO authenticated, service_role;