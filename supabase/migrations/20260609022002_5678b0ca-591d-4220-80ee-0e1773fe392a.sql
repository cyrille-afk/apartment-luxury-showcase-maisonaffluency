WITH first_old AS (
  SELECT DISTINCT ON (record_id) record_id, old_data->>'biography' AS bio
  FROM public.content_audit_log
  WHERE table_name = 'designers'
    AND created_at BETWEEN '2026-06-09 02:12:00+00'::timestamptz AND '2026-06-09 02:14:00+00'::timestamptz
  ORDER BY record_id, created_at ASC
)
UPDATE public.designers d
SET biography = regexp_replace(f.bio, '\[([^\]]+)\]\(https?://[^\)]+\)', '\1', 'g')
FROM first_old f
WHERE d.id = f.record_id::uuid
  AND f.bio IS NOT NULL;