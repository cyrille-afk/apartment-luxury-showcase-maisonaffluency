CREATE INDEX IF NOT EXISTS email_send_log_invite_key_idx ON public.email_send_log ((metadata->>'idempotency_key')) WHERE template_name = 'board-collaborator-invite';
CREATE INDEX IF NOT EXISTS email_send_log_message_latest_idx ON public.email_send_log (message_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.board_invitation_email_status(_board_id uuid)
RETURNS TABLE(invite_id uuid, email_status text, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_board(_board_id) THEN
  RAISE EXCEPTION 'Folder manager access required' USING ERRCODE = '42501';
 END IF;
 RETURN QUERY
 SELECT i.id, COALESCE(latest.status, CASE WHEN suppression.email IS NOT NULL THEN 'suppressed' ELSE 'unconfirmed' END), COALESCE(latest.created_at, suppression.created_at)
 FROM public.board_invites i
 LEFT JOIN LATERAL (
  SELECT DISTINCT ON (e.message_id) e.message_id
  FROM public.email_send_log e
  WHERE e.template_name = 'board-collaborator-invite'
   AND e.metadata->>'idempotency_key' = 'board-invite-' || i.id::text
   AND lower(trim(e.recipient_email)) = lower(trim(i.email)) AND e.message_id IS NOT NULL
  ORDER BY e.message_id, e.created_at DESC
 ) correlated ON true
 LEFT JOIN LATERAL (
  SELECT e.status, e.created_at FROM public.email_send_log e
  WHERE e.message_id = correlated.message_id AND lower(trim(e.recipient_email)) = lower(trim(i.email))
  ORDER BY e.created_at DESC, e.id DESC LIMIT 1
 ) latest ON true
 LEFT JOIN LATERAL (
  SELECT s.email, s.created_at FROM public.suppressed_emails s WHERE lower(trim(s.email))=lower(trim(i.email)) LIMIT 1
 ) suppression ON true
 WHERE i.board_id=_board_id AND i.status <> 'revoked';
END;
$function$;
REVOKE ALL ON FUNCTION public.board_invitation_email_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.board_invitation_email_status(uuid) TO authenticated, service_role;