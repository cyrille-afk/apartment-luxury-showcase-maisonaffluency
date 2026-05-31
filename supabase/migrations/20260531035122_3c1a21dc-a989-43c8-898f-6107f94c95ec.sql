
REVOKE EXECUTE ON FUNCTION public.match_semantic_cache(text, text, vector, double precision, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_semantic_cache(text, text, vector, double precision, integer) TO service_role;
