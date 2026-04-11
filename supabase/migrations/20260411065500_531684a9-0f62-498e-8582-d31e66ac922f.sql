-- Backfill country on existing document_downloads from trade_applications
UPDATE public.document_downloads dd
SET country = ta.country
FROM public.trade_applications ta
WHERE ta.user_id = dd.user_id
  AND ta.status = 'approved'
  AND (dd.country IS NULL OR dd.country = '');