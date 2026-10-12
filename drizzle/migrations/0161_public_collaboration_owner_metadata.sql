CREATE FUNCTION public.public_collaboration_owner_metadata(_ids uuid[])
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public
AS $function$
 SELECT d.id,d.name,d.slug FROM public.designers d
 WHERE d.id = ANY(_ids) AND d.id = '27ec2534-5f58-4294-b2e7-5bacf8b796d6'::uuid AND d.is_published = true
 AND EXISTS (SELECT 1 FROM public.designer_curator_picks_public p WHERE p.designer_id=d.id AND p.id IN ('11179934-a17e-4d81-9f49-b84c19b43a4a'::uuid,'6f7996bc-a985-45ec-8c31-bf97c4a71dd4'::uuid,'b0578007-d436-4fac-866f-1964b459942a'::uuid) AND p.is_hidden IS NOT TRUE);
$function$;
REVOKE ALL ON FUNCTION public.public_collaboration_owner_metadata(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_collaboration_owner_metadata(uuid[]) TO anon,authenticated,service_role;