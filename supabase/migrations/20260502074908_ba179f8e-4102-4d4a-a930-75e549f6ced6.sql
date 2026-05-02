
ALTER TABLE public.trade_documents
  ADD COLUMN IF NOT EXISTS is_featured_public boolean NOT NULL DEFAULT false;

-- Only one document may be the featured public catalogue at any time
CREATE UNIQUE INDEX IF NOT EXISTS trade_documents_one_featured_public
  ON public.trade_documents ((true))
  WHERE is_featured_public = true;

-- Speed up "latest featured" lookups
CREATE INDEX IF NOT EXISTS trade_documents_featured_public_recent
  ON public.trade_documents (created_at DESC)
  WHERE is_featured_public = true;
