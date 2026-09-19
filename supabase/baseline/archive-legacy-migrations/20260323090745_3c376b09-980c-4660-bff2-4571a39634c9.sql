-- Backfill baseline snapshot with proper UUID cast

INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, new_data, created_at)
SELECT 'designers', 'INSERT', d.id, NULL::uuid, to_jsonb(d), now()
FROM designers d;

INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, new_data, created_at)
SELECT 'designer_curator_picks', 'INSERT', cp.id, NULL::uuid, to_jsonb(cp), now()
FROM designer_curator_picks cp;

INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, new_data, created_at)
SELECT 'trade_documents', 'INSERT', td.id, NULL::uuid, to_jsonb(td), now()
FROM trade_documents td;