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
4. **Column-level write guards** on `profiles`, `trade_quotes`, and
   `trade_quote_items` — these are the last line of defense for financial
   and tier data. They are enforced by `BEFORE UPDATE` triggers that run
   *after* RLS has already decided whether the row may be updated.

## How column-level guards work

Row-level policies decide **who can touch a row**. Column-level guards
decide **which columns a non-admin may change** inside that row. Both
layers must pass for an update to succeed.

### Two-layer enforcement

1. **RLS policies** first restrict access to the row. For example, a trade
   quote can only be updated by its owner, a studio editor/admin, or a
   platform admin.
2. **BEFORE UPDATE triggers** then inspect the incoming values. If a
   non-admin (or non-service-role) caller tries to change a protected
   column, the trigger **silently reverts the value** to its previous
   state and logs the tamper attempt. The original statement still
   commits, so the attacker gets no error message and no hint that the
   value was not changed.

### Protected columns

| Table | Columns silently reverted for non-admins |
|-------|-------------------------------------------|
| `profiles` | `trade_tier`, `trade_tier_locked_by_admin`, `trade_tier_suggested`, `trade_tier_computed_at` |
| `trade_quotes` | `net_discount_pct`, `commission_pct`, `credit_applied_cents`, `insurance_rate_bps`, `billing_mode` |
| `trade_quote_items` | `unit_price_cents`, `unit_price_currency`, `fabric_upcharge_cents`, `fabric_currency` |

Admins and service-role requests bypass the guards entirely.

### Audit and alerting

When a guard reverts a protected column, it calls
`public.log_pricing_tamper_attempt(source, table_name, user_id, columns)`:

- An `INSERT` is always written to `public.security_audit_events` with
  `event_type = 'pricing_tamper_attempt'` and a JSONB payload containing
  the table, the attempted values, and the reverted values.
- Immediate admin email alerts are fired via a `pg_net.http_post` webhook
  to the `security-alert` edge function. Alerts are rate-limited per
  `(user_id, table_name)` to one message per 15 minutes, so a probing
  attacker cannot flood inboxes.
- If the webhook itself fails, the guard still reverts the value and
  writes the audit row; the transaction is never aborted by the alert
  path.

This design intentionally **fails closed** (the protected field never
changes) while **failing open** on the alert path (an alert outage does
not break the guard).

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
  ever run this from a direct (non-pooled) connection, the runtime
  section exercises live silent reverts under a simulated JWT.
- The fixture references one real `profiles.id` so `clients.created_by`
  (FK to `auth.users`) can be satisfied. The transaction is rolled back
  at the end, so the user record is never touched.
