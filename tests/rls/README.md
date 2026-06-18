# RLS regression tests

A SQL-driven regression suite that locks in the Row-Level Security design
captured in `security-memory`. Every run aborts on the first failed
assertion, and the whole script runs inside `BEGIN`/`ROLLBACK` so no
fixtures persist.

## What it covers

1. **Access-helper truth table** — `can_view_studio`, `can_edit_studio`,
   `has_studio_role` evaluated for viewer / editor / admin / outsider
   uuids against a synthetic studio.
2. **Structural policy assertions** on `clients`, `client_contacts`,
   `order_timeline`, `trade_quotes` — the SELECT / UPDATE / DELETE quals
   must still reference the expected predicates so viewers stay locked
   out of writes (and out of `client_contacts`, `order_timeline`,
   `trade_quotes` entirely).
3. **Service-role lockdown** on `ai_response_cache`, `ai_semantic_cache`,
   `concierge_rag_traces`, `email_send_log`, `email_unsubscribe_tokens` —
   RLS is enabled and every write policy is gated on
   `auth.role() = 'service_role'` or admin (no path is reachable from
   `authenticated` / `anon`).

## Running

The runner uses the standard `PG*` env vars (`PGHOST`, `PGPORT`,
`PGUSER`, `PGPASSWORD`, `PGDATABASE`) pointing at the project's
Supabase database.

```bash
tests/rls/run.sh
```

A passing run prints `All RLS regression assertions passed.` and exits 0.
Any failure prints `ASSERT FAIL: <message>` and exits non-zero.

## Notes

- Pooled Supabase connections forbid `SET ROLE authenticated`, so the
  suite verifies the policy *expressions* and the helper *behaviour*
  rather than executing queries as the `authenticated` role. If you
  ever run this from a direct (non-pooled) connection, you can extend
  section 2 of `policies.test.sql` with live `SET LOCAL ROLE` +
  `SET LOCAL request.jwt.claims` blocks against the same fixtures.
- The fixture references one real `profiles.id` so `clients.created_by`
  (FK to `auth.users`) can be satisfied. The transaction is rolled back
  at the end, so the user record is never touched.
