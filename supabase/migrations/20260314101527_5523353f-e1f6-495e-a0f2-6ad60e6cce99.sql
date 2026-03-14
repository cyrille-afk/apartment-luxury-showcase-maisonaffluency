-- Create article category enum
CREATE TYPE public.journal_category AS ENUM (
  'designer_interview',
  'collection_story',
  'design_trend',
  'project_showcase',
  'international_editorial'
);

-- Create journal articles table
CREATE TABLE public.journal_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  cover_image_url text,
  category public.journal_category NOT NULL DEFAULT 'design_trend',
  author text NOT NULL DEFAULT 'Maison Affluency',
  tags text[] DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  read_time_minutes smallint DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.journal_articles ENABLE ROW LEVEL SECURITY;

-- Public read access for published articles (no auth required for SEO)
CREATE POLICY "Anyone can view published articles"
ON public.journal_articles
FOR SELECT
TO anon, authenticated
USING (is_published = true);

-- Admins can manage all articles
CREATE POLICY "Admins can manage articles"
ON public.journal_articles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));