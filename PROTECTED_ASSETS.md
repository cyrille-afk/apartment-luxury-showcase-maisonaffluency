# Protected Assets & Folders

> **This file documents folders and files that must NEVER be deleted, renamed, or modified during development.**

## Protected Directories

| Path | Reason |
|------|--------|
| `src/components/old_content/` | Legacy content components — preserved as reference and fallback |
| `supabase/migrations/` | Database migration history — managed by Lovable Cloud, read-only |

## Protected Files (auto-generated, never edit)

| Path | Reason |
|------|--------|
| `src/integrations/supabase/client.ts` | Auto-generated Supabase client |
| `src/integrations/supabase/types.ts` | Auto-generated database types |
| `.env` | Auto-managed environment variables |

## Data Safety Rules

1. **Never bulk-delete** rows from `designers` or `designer_curator_picks` without explicit confirmation — these are the single source of truth for the Trade Portal.
2. **Audit triggers** are active on `designers`, `designer_curator_picks`, and `trade_documents` — all changes are logged to `content_audit_log`.
3. **Storage bucket `assets/`** contains uploaded brand thumbnails, PDFs, and editorial media — do not purge.

## Recovery

If data is accidentally deleted, check `content_audit_log` for the `DELETE` operation and use the Admin Audit Log viewer (`/trade/audit-log`) to restore from snapshot.
