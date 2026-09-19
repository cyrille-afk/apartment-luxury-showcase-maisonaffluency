# Database baseline

## `schema.sql` — the definitive snapshot

`supabase/baseline/schema.sql` recreates the entire `public` schema on an empty
database in one pass: extensions, enums, tables, columns, constraints, indexes,
views, functions, triggers, RLS state, policies and grants.

```bash
psql "$TARGET_DB_URL" -f supabase/baseline/schema.sql
```

Regenerate it after any schema change:

```bash
./scripts/db-baseline.sh            # dumps $SUPABASE_DB_URL
./scripts/db-baseline.sh "$OTHER"   # or an explicit database URL
```

Not included (Supabase-managed — recreate separately): the `auth`, `storage`
and `realtime` schemas, storage buckets, cron jobs, edge-function secrets, and
data rows.

## `archive-legacy-migrations/` — 787 historic files

The pre-Drizzle migration history, every file already recorded as applied in
`supabase_migrations.schema_migrations` on production. None of them will ever
run again; they are kept for forensics only and moved out of
`supabase/migrations/` so nothing replays or greps them as live.

## New schema changes

New changes go through the Drizzle custom-migration runner
(`drizzle/migrations/`, tracked in `drizzle.__drizzle_migrations`).

**That history is deliberately not squashed.** The runner verifies each file by
content hash against rows already recorded in the production database — if those
43 files were collapsed into one, the tracker would see an unknown migration and
try to re-execute it against a database that already has every object, which
fails and would desynchronise the tracker. Squashing them is only safe on a
database that is being rebuilt from scratch, and for that case `schema.sql`
already does the job.
