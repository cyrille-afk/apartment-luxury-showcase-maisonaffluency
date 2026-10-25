DO $change$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.approve_shared_room(text)'::regprocedure) INTO definition;
 definition := replace(definition, 'IF inv.id IS NULL OR inv.role', 'IF inv.id IS NULL OR inv.view_only OR inv.role');
 EXECUTE definition;
END $change$;