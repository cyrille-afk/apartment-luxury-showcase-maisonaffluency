CREATE OR REPLACE FUNCTION public.public_trade_only_designer_credit(_slug text)
RETURNS TABLE(id uuid, name text, slug text, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public
AS $function$
 SELECT d.id, d.name, d.slug, d.display_name FROM public.designers d
 WHERE d.slug = _slug AND d.is_published = true AND (
  (d.id = '1124b721-37e8-4a94-9adc-5b055fe892e0'::uuid AND EXISTS (
   SELECT 1 FROM public.designer_curator_picks_public p WHERE p.id = '4b46af75-4c35-4a81-bea6-822810ae3422'::uuid AND p.designer_id = d.id AND p.is_hidden IS NOT TRUE
  )) OR
  (d.id = '27ec2534-5f58-4294-b2e7-5bacf8b796d6'::uuid AND EXISTS (
   SELECT 1 FROM public.designer_curator_picks_public p WHERE p.id IN ('11179934-a17e-4d81-9f49-b84c19b43a4a'::uuid,'6f7996bc-a985-45ec-8c31-bf97c4a71dd4'::uuid,'b0578007-d436-4fac-866f-1964b459942a'::uuid) AND p.designer_id = d.id AND p.is_hidden IS NOT TRUE
  ))
 );
$function$;