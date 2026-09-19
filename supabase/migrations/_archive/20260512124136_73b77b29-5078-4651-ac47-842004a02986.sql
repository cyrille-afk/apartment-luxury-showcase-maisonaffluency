
-- Revoke anon execute on SECURITY DEFINER functions that aren't part of the public surface.
-- Keep anon access only for the unauthenticated client-portal helpers and the public download logger.
DO $$
DECLARE
  r record;
  keep text[] := ARRAY[
    'get_board_by_token',
    'get_board_items_by_token',
    'get_board_comments_by_token',
    'add_board_comment_by_token',
    'update_item_approval_by_token',
    'log_public_download_event'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'execute')
      AND NOT (p.proname = ANY(keep))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, public', r.proname, r.args);
  END LOOP;
END $$;
