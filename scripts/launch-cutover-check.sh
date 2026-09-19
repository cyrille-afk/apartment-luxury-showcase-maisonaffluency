#!/usr/bin/env bash
# Launch Day Cutover Playbook — pre-deployment guardrails.
#
#   bash scripts/launch-cutover-check.sh
#
# Runs three independent audits and exits non-zero if any of them fails:
#   1. Live credentials  — calls the admin-only `deployment-readiness` edge
#                          function (set LAUNCH_ADMIN_EMAIL / LAUNCH_ADMIN_PASSWORD).
#   2. Schema structure  — production table / policy / index counts must match
#                          the squashed baseline in supabase/baseline/schema.sql.
#   3. FX sync           — the twice-daily cron must exist and be active, and
#                          currency_rates must hold a fresh snapshot.
#
# Requires the managed PG* env vars for the database audits.
set -uo pipefail

EXPECTED_TABLES=${EXPECTED_TABLES:-179}
EXPECTED_POLICIES=${EXPECTED_POLICIES:-421}
EXPECTED_INDEXES=${EXPECTED_INDEXES:-545}
FAILED=0

section() { printf "\n\033[1m%s\033[0m\n" "$1"; }
pass() { printf "  ✔ %s\n" "$1"; }
fail() { printf "  ✘ %s\n" "$1"; FAILED=1; }

# ---------------------------------------------------------------- 1. secrets
section "1. Live environment credentials"
if [[ -n "${LAUNCH_ADMIN_EMAIL:-}" && -n "${LAUNCH_ADMIN_PASSWORD:-}" ]]; then
  node scripts/launch-readiness-report.mjs || FAILED=1
else
  echo "  – skipped: set LAUNCH_ADMIN_EMAIL / LAUNCH_ADMIN_PASSWORD to query the"
  echo "    admin-only deployment-readiness endpoint."
fi

# ----------------------------------------------------------------- 2. schema
section "2. Database structure vs squashed baseline"
read -r T P I <<<"$(psql -tA -F' ' -c "
  select (select count(*) from pg_tables   where schemaname='public'),
         (select count(*) from pg_policies where schemaname='public'),
         (select count(*) from pg_indexes  where schemaname='public')")"

[[ "$T" == "$EXPECTED_TABLES"   ]] && pass "tables:   $T"   || fail "tables:   $T (expected $EXPECTED_TABLES)"
[[ "$P" == "$EXPECTED_POLICIES" ]] && pass "policies: $P"   || fail "policies: $P (expected $EXPECTED_POLICIES)"
[[ "$I" == "$EXPECTED_INDEXES"  ]] && pass "indexes:  $I"   || fail "indexes:  $I (expected $EXPECTED_INDEXES)"

BASELINE_TABLES=$(grep -c "^CREATE TABLE" supabase/baseline/schema.sql)
[[ "$BASELINE_TABLES" == "$T" ]] \
  && pass "baseline schema.sql declares the same $BASELINE_TABLES tables" \
  || fail "baseline schema.sql declares $BASELINE_TABLES tables, production has $T"

RLS_OFF=$(psql -tA -c "select count(*) from pg_tables t
  join pg_class c on c.relname=t.tablename and c.relnamespace='public'::regnamespace
  where t.schemaname='public' and not c.relrowsecurity")
[[ "$RLS_OFF" == "0" ]] && pass "row level security enabled on every public table" \
                        || fail "$RLS_OFF public table(s) without RLS"

# --------------------------------------------------------------------- 3. FX
section "3. Server-side FX sync"
CRON=$(psql -tA -c "select schedule || '|' || active from cron.job
                    where jobname='sync-currency-rates-twice-daily'" 2>/dev/null)
if [[ "$CRON" == "0 6,18 * * *|t" ]]; then
  pass "cron sync-currency-rates-twice-daily active at 06:00 + 18:00 UTC"
else
  fail "FX cron missing or altered (got: '${CRON:-none}')"
fi

read -r PAIRS AGE <<<"$(psql -tA -F' ' -c "
  select count(*), coalesce(round(extract(epoch from now()-max(last_updated_at))/3600,1),9999)
  from currency_rates")"
[[ "$PAIRS" -ge 90 ]] && pass "currency_rates holds $PAIRS pairs" || fail "only $PAIRS FX pairs stored"
awk -v a="$AGE" 'BEGIN{exit !(a<13)}' \
  && pass "latest snapshot ${AGE}h old" \
  || fail "FX snapshot is ${AGE}h old — sync has not run"

section "Result"
if [[ "$FAILED" == "0" ]]; then echo "  ALL CHECKS PASSED"; else echo "  CHECKS FAILED"; fi
exit "$FAILED"
