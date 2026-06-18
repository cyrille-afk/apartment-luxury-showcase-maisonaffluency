-- RLS policy regression tests.
--
-- Verifies that each sensitive table's Row-Level Security policy aligns with
-- the design captured in the security memory: editor/admin can act, viewer is
-- read-only (or excluded), outsiders see nothing, and service-role-only tables
-- expose no authenticated write paths.
--
-- The whole script runs inside a BEGIN/ROLLBACK transaction, so fixtures
-- never persist. Each assertion either prints "PASS:" via NOTICE or aborts
-- the script with "ASSERT FAIL: ...".
--
-- Run with: tests/rls/run.sh

\set ON_ERROR_STOP on
\timing off
\set QUIET on
SET client_min_messages TO NOTICE;

BEGIN;

-- ---------------------------------------------------------------------------
-- Assertion helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.assert(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN
    RAISE EXCEPTION 'ASSERT FAIL: %', msg;
  END IF;
  RAISE NOTICE 'PASS: %', msg;
END
$$;

-- Try-block helper: returns TRUE iff the SQL raised an error.
CREATE OR REPLACE FUNCTION pg_temp.expect_error(sql text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
    RETURN FALSE;
  EXCEPTION WHEN OTHERS THEN
    RETURN TRUE;
  END;
END
$$;

-- ---------------------------------------------------------------------------
-- Fixture: one studio, three synthetic members, one outsider
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _owner_uid uuid;
BEGIN
  SELECT id INTO _owner_uid FROM public.profiles LIMIT 1;
  IF _owner_uid IS NULL THEN
    RAISE EXCEPTION 'fixture: need at least one profiles row to satisfy clients.created_by FK';
  END IF;
  PERFORM set_config('rls_test.owner_uid', _owner_uid::text, false);
END $$;

INSERT INTO public.studios (id, name, created_by)
VALUES ('11111111-1111-1111-1111-111111111aa1',
        'RLS Test Studio',
        current_setting('rls_test.owner_uid')::uuid);

INSERT INTO public.studio_members (studio_id, user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111aa1', '11111111-1111-1111-1111-111111111001', 'viewer'::studio_role),
  ('11111111-1111-1111-1111-111111111aa1', '11111111-1111-1111-1111-111111111002', 'editor'::studio_role),
  ('11111111-1111-1111-1111-111111111aa1', '11111111-1111-1111-1111-111111111003', 'admin'::studio_role);

INSERT INTO public.clients (id, studio_id, created_by, name, type)
VALUES ('11111111-1111-1111-1111-111111111c01',
        '11111111-1111-1111-1111-111111111aa1',
        current_setting('rls_test.owner_uid')::uuid,
        'Test Client', 'individual');

INSERT INTO public.client_contacts (id, client_id, first_name, last_name, is_primary, email, phone)
VALUES ('11111111-1111-1111-1111-111111111d01',
        '11111111-1111-1111-1111-111111111c01',
        'Jane', 'Doe', true, 'jane@example.com', '+1 555 0100');

-- ---------------------------------------------------------------------------
-- 1. Access predicate behaviour (helper functions used by every policy)
-- ---------------------------------------------------------------------------
SELECT pg_temp.assert(
  public.can_view_studio('11111111-1111-1111-1111-111111111001'::uuid, '11111111-1111-1111-1111-111111111aa1'::uuid),
  'viewer can view studio');
SELECT pg_temp.assert(
  NOT public.can_edit_studio('11111111-1111-1111-1111-111111111001'::uuid, '11111111-1111-1111-1111-111111111aa1'::uuid),
  'viewer CANNOT edit studio');

SELECT pg_temp.assert(
  public.can_view_studio('11111111-1111-1111-1111-111111111002'::uuid, '11111111-1111-1111-1111-111111111aa1'::uuid),
  'editor can view studio');
SELECT pg_temp.assert(
  public.can_edit_studio('11111111-1111-1111-1111-111111111002'::uuid, '11111111-1111-1111-1111-111111111aa1'::uuid),
  'editor can edit studio');
SELECT pg_temp.assert(
  public.has_studio_role('11111111-1111-1111-1111-111111111002'::uuid, '11111111-1111-1111-1111-111111111aa1'::uuid, 'editor'::studio_role),
  'editor satisfies has_studio_role(editor)');
SELECT pg_temp.assert(
  NOT public.has_studio_role('11111111-1111-1111-1111-111111111001'::uuid, '11111111-1111-1111-1111-111111111aa1'::uuid, 'editor'::studio_role),
  'viewer does NOT satisfy has_studio_role(editor)');

SELECT pg_temp.assert(
  public.has_studio_role('11111111-1111-1111-1111-111111111003'::uuid, '11111111-1111-1111-1111-111111111aa1'::uuid, 'admin'::studio_role),
  'admin satisfies has_studio_role(admin)');

SELECT pg_temp.assert(
  NOT public.can_view_studio('11111111-1111-1111-1111-111111111999'::uuid, '11111111-1111-1111-1111-111111111aa1'::uuid),
  'outsider CANNOT view studio');

-- ---------------------------------------------------------------------------
-- 2. End-to-end RLS as authenticated under simulated JWT
-- ---------------------------------------------------------------------------
-- viewer can read client + contact rows
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111001","role":"authenticated"}';

SELECT pg_temp.assert(
  (SELECT count(*) FROM public.clients WHERE id='11111111-1111-1111-1111-111111111c01') = 1,
  'clients: viewer can SELECT studio client (can_view_studio path)');

-- viewer is excluded from client_contacts (policy = can_edit_studio)
SELECT pg_temp.assert(
  (SELECT count(*) FROM public.client_contacts WHERE id='11111111-1111-1111-1111-111111111d01') = 0,
  'client_contacts: viewer CANNOT SELECT contact (editor-only)');

-- viewer cannot UPDATE clients (write requires can_edit_studio)
SELECT pg_temp.assert(
  (SELECT count(*) FROM (
     UPDATE public.clients SET name='hijack' WHERE id='11111111-1111-1111-1111-111111111c01' RETURNING 1
  ) s) = 0,
  'clients: viewer UPDATE is silently filtered (zero rows affected)');

RESET ROLE;
RESET request.jwt.claims;

-- editor can read both and update clients
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111002","role":"authenticated"}';

SELECT pg_temp.assert(
  (SELECT count(*) FROM public.clients WHERE id='11111111-1111-1111-1111-111111111c01') = 1,
  'clients: editor can SELECT');
SELECT pg_temp.assert(
  (SELECT count(*) FROM public.client_contacts WHERE id='11111111-1111-1111-1111-111111111d01') = 1,
  'client_contacts: editor can SELECT');
SELECT pg_temp.assert(
  (SELECT count(*) FROM (
     UPDATE public.clients SET name='edited-by-editor' WHERE id='11111111-1111-1111-1111-111111111c01' RETURNING 1
  ) s) = 1,
  'clients: editor can UPDATE (1 row affected)');

RESET ROLE;
RESET request.jwt.claims;

-- outsider authenticated user sees nothing in this studio
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111999","role":"authenticated"}';

SELECT pg_temp.assert(
  (SELECT count(*) FROM public.clients WHERE id='11111111-1111-1111-1111-111111111c01') = 0,
  'clients: outsider CANNOT SELECT studio client');
SELECT pg_temp.assert(
  (SELECT count(*) FROM public.client_contacts WHERE id='11111111-1111-1111-1111-111111111d01') = 0,
  'client_contacts: outsider CANNOT SELECT contact');

RESET ROLE;
RESET request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 3. Structural policy assertions (catch silent drift / scanner re-flags)
-- ---------------------------------------------------------------------------

-- clients
SELECT pg_temp.assert(
  EXISTS (SELECT 1 FROM pg_policies
          WHERE schemaname='public' AND tablename='clients' AND cmd='SELECT'
            AND qual LIKE '%can_view_studio%'),
  'clients SELECT policy uses can_view_studio');
SELECT pg_temp.assert(
  EXISTS (SELECT 1 FROM pg_policies
          WHERE schemaname='public' AND tablename='clients' AND cmd='UPDATE'
            AND qual LIKE '%can_edit_studio%'),
  'clients UPDATE policy uses can_edit_studio (viewer locked out)');
SELECT pg_temp.assert(
  EXISTS (SELECT 1 FROM pg_policies
          WHERE schemaname='public' AND tablename='clients' AND cmd='DELETE'
            AND qual LIKE '%can_edit_studio%'),
  'clients DELETE policy uses can_edit_studio');

-- client_contacts (all four CRUD policies must gate on can_edit_studio)
SELECT pg_temp.assert(
  (SELECT count(*) FROM pg_policies
   WHERE schemaname='public' AND tablename='client_contacts'
     AND (qual LIKE '%can_edit_studio%' OR with_check LIKE '%can_edit_studio%')) >= 4,
  'client_contacts: all CRUD policies gate on can_edit_studio (viewer excluded)');

-- order_timeline (SELECT/UPDATE require editor or project edit, viewer excluded)
SELECT pg_temp.assert(
  EXISTS (SELECT 1 FROM pg_policies
          WHERE schemaname='public' AND tablename='order_timeline' AND cmd='SELECT'
            AND policyname='View timelines (studio + project access)'
            AND qual LIKE '%has_studio_role%''editor''%'),
  'order_timeline SELECT requires editor studio role (viewers excluded)');
SELECT pg_temp.assert(
  EXISTS (SELECT 1 FROM pg_policies
          WHERE schemaname='public' AND tablename='order_timeline' AND cmd='UPDATE'
            AND qual LIKE '%can_edit_studio%' OR qual LIKE '%can_edit_project%'),
  'order_timeline UPDATE requires editor (studio or project)');

-- trade_quotes (SELECT requires editor; viewer excluded)
SELECT pg_temp.assert(
  EXISTS (SELECT 1 FROM pg_policies
          WHERE schemaname='public' AND tablename='trade_quotes' AND cmd='SELECT'
            AND policyname='View quotes (studio + project access)'
            AND qual LIKE '%has_studio_role%''editor''%'),
  'trade_quotes SELECT requires editor studio role (viewers excluded)');

-- ---------------------------------------------------------------------------
-- 4. Service-role-only tables: NO authenticated write surface
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _t text;
  _bad int;
BEGIN
  FOREACH _t IN ARRAY ARRAY[
    'ai_response_cache',
    'ai_semantic_cache',
    'concierge_rag_traces',
    'email_send_log',
    'email_unsubscribe_tokens'
  ] LOOP
    -- RLS must be enabled
    PERFORM pg_temp.assert(
      (SELECT relrowsecurity FROM pg_class
       WHERE oid = ('public.'||_t)::regclass),
      _t || ': RLS is enabled');

    -- No INSERT/UPDATE/DELETE/ALL policy may be open to the authenticated role
    SELECT count(*) INTO _bad
    FROM pg_policies
    WHERE schemaname='public' AND tablename=_t
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
      AND ('authenticated' = ANY(roles) OR 'public' = ANY(roles) OR 'anon' = ANY(roles));
    PERFORM pg_temp.assert(
      _bad = 0,
      _t || ': no write policy exposed to authenticated/anon/public ('||_bad||' found)');
  END LOOP;
END $$;

-- ai_response_cache / ai_semantic_cache must NOT have an authenticated SELECT
-- broader than admin (admin-only or none).
SELECT pg_temp.assert(
  NOT EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND tablename='ai_response_cache'
                AND cmd IN ('SELECT','ALL')
                AND 'authenticated' = ANY(roles)
                AND qual NOT LIKE '%has_role%admin%'),
  'ai_response_cache: any authenticated SELECT must be admin-gated');

SELECT pg_temp.assert(
  NOT EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND tablename='concierge_rag_traces'
                AND cmd IN ('SELECT','ALL')
                AND 'authenticated' = ANY(roles)
                AND qual NOT LIKE '%has_role%admin%'),
  'concierge_rag_traces: any authenticated SELECT must be admin-gated');

-- 5. Behavioural service-role lockdown: authenticated outsider cannot read
--    any of these tables.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111999","role":"authenticated"}';

SELECT pg_temp.assert(
  pg_temp.expect_error($q$SELECT count(*) FROM public.ai_semantic_cache$q$)
  OR (SELECT count(*) FROM public.ai_semantic_cache) = 0,
  'ai_semantic_cache: outsider authenticated cannot read rows');
SELECT pg_temp.assert(
  pg_temp.expect_error($q$SELECT count(*) FROM public.email_unsubscribe_tokens$q$)
  OR (SELECT count(*) FROM public.email_unsubscribe_tokens) = 0,
  'email_unsubscribe_tokens: outsider authenticated cannot read rows');

-- Insert attempts must fail (no policy permits authenticated writes).
SELECT pg_temp.assert(
  pg_temp.expect_error($q$INSERT INTO public.concierge_rag_traces (user_id, query) VALUES ('11111111-1111-1111-1111-111111111999','hijack')$q$),
  'concierge_rag_traces: outsider INSERT is blocked');

RESET ROLE;
RESET request.jwt.claims;

\echo ''
\echo '================================================='
\echo '  All RLS regression assertions passed.'
\echo '================================================='

ROLLBACK;
