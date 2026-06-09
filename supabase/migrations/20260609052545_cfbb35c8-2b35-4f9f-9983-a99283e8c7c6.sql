-- Media-safe biography sanitizer.
-- Removes citation links like [text](https://...) and bare URL lines that are NOT
-- standalone media embeds (YouTube / Vimeo / Cloudinary). Standalone media URLs
-- on their own line are preserved so the editorial renderer can embed them.
CREATE OR REPLACE FUNCTION public.sanitize_biography_citations(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text := input;
  media_host_re text := '(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com|res\.cloudinary\.com)';
BEGIN
  IF result IS NULL OR result = '' THEN
    RETURN result;
  END IF;

  -- 1. Strip markdown links [label](url) -> label.
  --    Media URLs are never written as markdown links in our editorial format
  --    (they live on their own line), so this is always citation noise.
  result := regexp_replace(result, '\[([^\]]+)\]\(https?://[^)]+\)', '\1', 'g');

  -- 2. Strip bare non-media URL lines (entire line is a URL, optionally with
  --    a " | caption | alignment" suffix). Preserve lines whose URL points to
  --    a known media host.
  result := regexp_replace(
    result,
    '(^|\n)[ \t]*https?://(?!([^\s/]+\.)?' || media_host_re || ')[^\s\n]+(\s*\|[^\n]*)?(?=\n|$)',
    '\1',
    'g'
  );

  -- 3. Collapse 3+ blank lines created by the strip down to 2.
  result := regexp_replace(result, '\n{3,}', E'\n\n', 'g');

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.sanitize_biography_citations(text) IS
  'Removes [text](url) markdown links and bare non-media URL lines from biography text. Preserves standalone YouTube/Vimeo/Cloudinary URLs so the editorial renderer can embed them.';

GRANT EXECUTE ON FUNCTION public.sanitize_biography_citations(text) TO authenticated, service_role;
