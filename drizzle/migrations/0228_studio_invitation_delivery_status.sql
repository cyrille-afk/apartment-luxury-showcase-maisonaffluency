CREATE OR REPLACE FUNCTION public.studio_invitation_list(_studio_id uuid)
RETURNS TABLE(id uuid, email text, role public.studio_role, created_at timestamptz, expires_at timestamptz, accepted_at timestamptz, status text, email_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_studio_role(auth.uid(), _studio_id, 'admin'::public.studio_role) THEN
  RAISE EXCEPTION 'Studio manager access required' USING ERRCODE = '42501';
 END IF;
 RETURN QUERY
 SELECT i.id, i.email, i.role, i.created_at, i.expires_at, i.accepted_at,
  CASE WHEN i.accepted_at IS NOT NULL THEN 'accepted'
   WHEN latest.status IN ('pending','sent') THEN 'pending'
   ELSE 'failed' END::text,
  COALESCE(latest.status, 'not_sent')::text
 FROM public.studio_invites i
 LEFT JOIN LATERAL (
  SELECT l.message_id FROM public.email_send_log l
  WHERE l.template_name = 'studio-teammate-invite'
   AND l.metadata->>'idempotency_key' LIKE 'studio-invite-' || i.id::text || '-%'
  ORDER BY l.created_at DESC, l.id DESC LIMIT 1
 ) attempt ON true
 LEFT JOIN LATERAL (
  SELECT l.status FROM public.email_send_log l WHERE l.message_id = attempt.message_id
  ORDER BY l.created_at DESC, l.id DESC LIMIT 1
 ) latest ON true
 WHERE i.studio_id = _studio_id
 ORDER BY i.created_at DESC, i.id;
END;
$$;
REVOKE ALL ON FUNCTION public.studio_invitation_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.studio_invitation_list(uuid) TO authenticated, service_role;