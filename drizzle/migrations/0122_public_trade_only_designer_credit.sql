-- Name-only credit for trade-only designers whose single approved gallery piece is public. Bio is never returned.
CREATE OR REPLACE FUNCTION public.public_trade_only_designer_credit(_slug text)
RETURNS TABLE(id uuid, name text, slug text, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT d.id, d.name, d.slug, d.display_name
  FROM public.designers d
  WHERE d.slug = _slug
    AND d.is_published = true
    AND d.id = '1124b721-37e8-4a94-9adc-5b055fe892e0'::uuid
    AND EXISTS (SELECT 1 FROM public.designer_curator_picks_public p
                WHERE p.id = '4b46af75-4c35-4a81-bea6-822810ae3422'::uuid AND p.designer_id = d.id AND p.is_hidden IS NOT TRUE);
$$;
GRANT EXECUTE ON FUNCTION public.public_trade_only_designer_credit(text) TO anon, authenticated;