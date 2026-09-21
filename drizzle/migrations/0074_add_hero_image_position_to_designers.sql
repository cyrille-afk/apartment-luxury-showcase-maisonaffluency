-- Add per-designer control over hero image crop alignment.
-- This lets vertical portraits keep their bottom half visible while truncating the top.
ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS hero_image_position TEXT DEFAULT 'center';

COMMENT ON COLUMN public.designers.hero_image_position IS
  'CSS object-position for the hero/wide hero image. Values: center (default), top, bottom, left, right, or any valid CSS object-position string.';

-- Backfill existing rows to the default so the column is never NULL.
UPDATE public.designers
  SET hero_image_position = 'center'
  WHERE hero_image_position IS NULL;

-- Amélie Vermersch: vertical screenshot portrait should keep the bottom and crop the top.
UPDATE public.designers
  SET hero_image_position = 'bottom'
  WHERE slug = 'amelie-vermersch';
