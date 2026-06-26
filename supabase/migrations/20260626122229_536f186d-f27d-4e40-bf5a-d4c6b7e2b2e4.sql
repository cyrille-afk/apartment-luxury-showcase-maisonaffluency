CREATE OR REPLACE FUNCTION public.sanitize_biography_citations(input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  result text := input;
  media_host_re text := '(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com|res\.cloudinary\.com|supabase\.co|supabase\.in)';
BEGIN
  IF result IS NULL OR result = '' THEN
    RETURN result;
  END IF;

  result := regexp_replace(result, '\[([^\]]+)\]\(https?://[^)]+\)', '\1', 'g');
  result := regexp_replace(result, '\s*\[Sources?:[^\]]*\]', '', 'gi');
  result := regexp_replace(
    result,
    '(^|\n)[ \t]*https?://(?!([^\s/]+\.)?' || media_host_re || ')[^\s\n]+(\s*\|[^\n]*)?(?=\n|$)',
    '\1',
    'g'
  );
  result := regexp_replace(result, '\n{3,}', E'\n\n', 'g');

  RETURN result;
END;
$function$;