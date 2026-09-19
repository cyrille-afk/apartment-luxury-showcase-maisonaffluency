-- Restore biographies (with inline video/image embeds) from audit log snapshot taken before URL-strip ran on 2026-06-09 02:12.
-- Then re-apply only the markdown-link removal the user asked for (strip [text](url) → text), preserving standalone media URLs.
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
