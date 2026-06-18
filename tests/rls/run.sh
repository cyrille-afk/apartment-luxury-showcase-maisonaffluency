#!/usr/bin/env bash
# Runner for the RLS regression test script.
# Requires PG* env vars (PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT) to point
# at the project's Supabase database.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${PGHOST:-}" ]]; then
  echo "ERROR: PGHOST is not set. Export the project's PG* environment first." >&2
  exit 2
fi

echo "Running RLS regression tests against ${PGHOST}/${PGDATABASE:-postgres} ..."

# -v ON_ERROR_STOP=1 makes any failed assertion abort with non-zero exit.
psql -v ON_ERROR_STOP=1 -f "${DIR}/policies.test.sql"
