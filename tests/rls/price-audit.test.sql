-- Read-only price-audit authorization regression checks. Each row must be true.
SELECT
  NOT has_table_privilege('anon', 'public.admin_price_save_attempts', 'SELECT') AS anonymous_history_blocked,
  has_table_privilege('authenticated', 'public.admin_price_save_attempts', 'SELECT') AS signed_in_read_granted,
  NOT has_table_privilege('authenticated', 'public.admin_price_save_attempts', 'INSERT') AS direct_forged_attempt_blocked,
  NOT has_table_privilege('authenticated', 'public.admin_price_save_attempts', 'UPDATE') AS direct_forged_saved_status_blocked,
  NOT has_table_privilege('authenticated', 'public.admin_price_save_attempts', 'DELETE') AS audit_deletion_blocked,
  NOT has_function_privilege('anon', 'public.begin_admin_price_save(uuid,uuid,text,jsonb)', 'EXECUTE') AS anonymous_begin_blocked,
  NOT has_function_privilege('anon', 'public.commit_admin_price_save(uuid)', 'EXECUTE') AS anonymous_commit_blocked,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.admin_price_save_attempts'::regclass) AS row_security_enabled,
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_price_save_attempts' AND cmd='SELECT' AND qual LIKE '%has_role(auth.uid(),%admin%') AS admin_only_read_policy;