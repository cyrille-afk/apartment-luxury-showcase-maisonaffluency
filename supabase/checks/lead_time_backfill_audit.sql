-- =====================================================================
-- Lead-time backfill audit
-- =====================================================================
-- Preflight and post-migration verification for canonical lead-time
-- columns on public.trade_products.
--
-- Usage:
--   psql -f supabase/checks/lead_time_backfill_audit.sql
--
-- Safe to run any time — all statements are read-only.
-- =====================================================================

\echo
\echo ==== 1. PREFLIGHT: expected columns exist ====
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'trade_products'
   AND column_name IN (
     'lead_time',
     'lead_weeks_min_override',
     'lead_weeks_max_override',
     'lead_time_weeks_min',
     'lead_time_weeks_max'
   )
 ORDER BY column_name;

\echo
\echo ==== 2. PREFLIGHT: source-data coverage ====
SELECT
  COUNT(*)                                                                        AS total_products,
  COUNT(*) FILTER (WHERE lead_time IS NOT NULL AND lead_time <> '')               AS with_text,
  COUNT(*) FILTER (WHERE lead_weeks_min_override IS NOT NULL
                    OR   lead_weeks_max_override IS NOT NULL)                     AS with_any_override,
  COUNT(*) FILTER (WHERE (lead_time IS NULL OR lead_time = '')
                    AND lead_weeks_min_override IS NULL
                    AND lead_weeks_max_override IS NULL)                          AS no_source_at_all
FROM public.trade_products;

\echo
\echo ==== 3. POST: canonical column coverage ====
SELECT
  COUNT(*)                                                     AS total_products,
  COUNT(lead_time_weeks_min)                                   AS with_min,
  COUNT(lead_time_weeks_max)                                   AS with_max,
  ROUND(100.0 * COUNT(lead_time_weeks_min) / COUNT(*), 1)      AS pct_with_min,
  ROUND(100.0 * COUNT(lead_time_weeks_max) / COUNT(*), 1)      AS pct_with_max
FROM public.trade_products;

\echo
\echo ==== 4. POST: sanity — min <= max invariant ====
SELECT COUNT(*) AS violations_min_gt_max
  FROM public.trade_products
 WHERE lead_time_weeks_min IS NOT NULL
   AND lead_time_weeks_max IS NOT NULL
   AND lead_time_weeks_min > lead_time_weeks_max;

\echo
\echo ==== 5. POST: out-of-range values (0..104 weeks acceptable) ====
SELECT
  COUNT(*) FILTER (WHERE lead_time_weeks_min < 0 OR lead_time_weeks_min > 104) AS min_out_of_range,
  COUNT(*) FILTER (WHERE lead_time_weeks_max < 0 OR lead_time_weeks_max > 104) AS max_out_of_range
FROM public.trade_products;

\echo
\echo ==== 6. POST: partial fills (only min or only max present) ====
SELECT
  COUNT(*) FILTER (WHERE lead_time_weeks_min IS NOT NULL AND lead_time_weeks_max IS NULL) AS min_only,
  COUNT(*) FILTER (WHERE lead_time_weeks_max IS NOT NULL AND lead_time_weeks_min IS NULL) AS max_only
FROM public.trade_products;

\echo
\echo ==== 7. POST: override vs canonical disagreement ====
-- If canonical was seeded from override, they must match unless a human
-- edited one afterwards. Any row here is a candidate for review.
SELECT id, brand_name, product_name,
       lead_weeks_min_override AS ovr_min, lead_time_weeks_min AS canon_min,
       lead_weeks_max_override AS ovr_max, lead_time_weeks_max AS canon_max
  FROM public.trade_products
 WHERE (lead_weeks_min_override IS NOT NULL
        AND lead_time_weeks_min IS DISTINCT FROM lead_weeks_min_override)
    OR (lead_weeks_max_override IS NOT NULL
        AND lead_time_weeks_max IS DISTINCT FROM lead_weeks_max_override)
 LIMIT 50;

\echo
\echo ==== 8. POST: text present but nothing parsed (needs manual fix) ====
SELECT lead_time, COUNT(*) AS rows
  FROM public.trade_products
 WHERE lead_time IS NOT NULL
   AND lead_time <> ''
   AND lead_time_weeks_min IS NULL
   AND lead_time_weeks_max IS NULL
 GROUP BY lead_time
 ORDER BY rows DESC;

\echo
\echo ==== 9. POST: canonical present but no source (should never happen) ====
SELECT COUNT(*) AS phantom_rows
  FROM public.trade_products
 WHERE (lead_time_weeks_min IS NOT NULL OR lead_time_weeks_max IS NOT NULL)
   AND (lead_time IS NULL OR lead_time = '')
   AND lead_weeks_min_override IS NULL
   AND lead_weeks_max_override IS NULL;

\echo
\echo ==== 10. POST: distribution of parsed max lead weeks ====
SELECT
  CASE
    WHEN lead_time_weeks_max IS NULL          THEN 'unknown'
    WHEN lead_time_weeks_max = 0              THEN '0 (in stock)'
    WHEN lead_time_weeks_max BETWEEN 1  AND 4  THEN '1-4'
    WHEN lead_time_weeks_max BETWEEN 5  AND 8  THEN '5-8'
    WHEN lead_time_weeks_max BETWEEN 9  AND 12 THEN '9-12'
    WHEN lead_time_weeks_max BETWEEN 13 AND 16 THEN '13-16'
    WHEN lead_time_weeks_max BETWEEN 17 AND 24 THEN '17-24'
    ELSE '25+'
  END AS bucket,
  COUNT(*) AS rows
FROM public.trade_products
GROUP BY 1
ORDER BY MIN(COALESCE(lead_time_weeks_max, -1));
