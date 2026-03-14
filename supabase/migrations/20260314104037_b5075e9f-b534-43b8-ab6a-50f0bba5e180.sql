ALTER TABLE public.journal_articles
ADD COLUMN gallery_images text[] DEFAULT '{}'::text[];