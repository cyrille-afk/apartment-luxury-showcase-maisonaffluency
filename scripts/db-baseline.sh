#!/usr/bin/env bash
# Regenerate the definitive baseline schema snapshot.
#
#   ./scripts/db-baseline.sh                 # uses $SUPABASE_DB_URL
#   ./scripts/db-baseline.sh "$OTHER_DB_URL" # dump a different database
#
# Writes supabase/baseline/schema.sql — a single file that recreates the whole
# public schema (tables, indexes, enums, views, functions, triggers, RLS
# policies, grants) on an empty database.
set -euo pipefail

DB_URL="${1:-${SUPABASE_DB_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "error: no database URL (pass one, or set SUPABASE_DB_URL)" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/supabase/baseline/schema.sql"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

pg_dump "$DB_URL" --schema-only --schema=public --no-owner -f "$TMP"

{
  cat <<'HDR'
-- =====================================================================
-- Maison Affluency — definitive baseline schema (public schema)
--
-- Generated with: scripts/db-baseline.sh   (pg_dump --schema-only)
-- This file is a SNAPSHOT of the live database structure: tables,
-- columns, constraints, indexes, enums, views, functions, triggers,
-- RLS state, policies and grants.
--
-- It is NOT applied by the migration runner. It exists so a fresh
-- environment (local test database, CI, staging clone) can be created
-- in one shot instead of replaying the whole migration history:
--
--   psql "$TARGET_DB_URL" -f supabase/baseline/schema.sql
--
-- Not included (Supabase-managed, recreate separately):
--   auth/storage/realtime schemas, storage buckets, cron jobs,
--   edge-function secrets, data rows.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS plpgsql;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

HDR
  cat "$TMP"
} > "$OUT"

echo "wrote $OUT ($(wc -l < "$OUT") lines)"
