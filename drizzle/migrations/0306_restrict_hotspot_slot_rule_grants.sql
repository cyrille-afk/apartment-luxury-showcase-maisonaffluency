REVOKE ALL ON public.hotspot_slot_rules FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.hotspot_slot_rules FROM authenticated;