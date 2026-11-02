ALTER TABLE public.directory_activity_events ADD COLUMN search_details jsonb;
ALTER TABLE public.directory_activity_events DROP CONSTRAINT directory_activity_events_kind_check;
ALTER TABLE public.directory_activity_events ADD CONSTRAINT directory_activity_events_kind_check CHECK (kind IN ('open','search','letter','dismiss','profile','refinement'));
CREATE OR REPLACE FUNCTION public.record_directory_refinement(_id uuid, _modal_id uuid, _surface text, _environment text, _details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE safe_details jsonb; matched text[];
BEGIN
 IF _surface NOT IN ('desktop','mobile') OR _environment NOT IN ('production','preview') OR _modal_id IS NULL OR jsonb_typeof(_details) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid refinement'; END IF;
 IF _details->>'refinement' IS NULL OR _details->>'refinement' NOT IN ('initial','extend','shorten','replace','clear','letter') OR _details->>'match_kind' IS NULL OR _details->>'match_kind' NOT IN ('empty','exact_designer','partial_designer','unmatched') THEN RAISE EXCEPTION 'Invalid refinement'; END IF;
 IF jsonb_typeof(_details->'matched_designers') IS DISTINCT FROM 'array' OR jsonb_array_length(_details->'matched_designers')>10 OR coalesce(_details->>'result_count','') !~ '^[0-9]{1,4}$' THEN RAISE EXCEPTION 'Invalid matches'; END IF;
 SELECT coalesce(array_agg(slug),'{}'::text[]) INTO matched FROM public.designers WHERE is_published AND NOT trade_only AND slug IN (SELECT jsonb_array_elements_text(_details->'matched_designers'));
 IF cardinality(matched) <> jsonb_array_length(_details->'matched_designers') THEN RAISE EXCEPTION 'Invalid catalogue matches'; END IF;
 safe_details=jsonb_build_object('refinement',_details->>'refinement','match_kind',_details->>'match_kind','matched_designers',to_jsonb(matched),'result_count',(_details->>'result_count')::integer);
 IF _details->>'letter' ~ '^[A-Z]$' THEN safe_details=safe_details || jsonb_build_object('letter',_details->>'letter'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext(_modal_id::text));
 IF NOT EXISTS(SELECT 1 FROM public.directory_activity_events WHERE modal_id=_modal_id AND kind='open' AND environment=_environment AND surface=_surface AND occurred_at>now()-interval '24 hours') OR (SELECT count(*) FROM public.directory_activity_events WHERE modal_id=_modal_id)>=500 THEN RETURN; END IF;
 INSERT INTO public.directory_activity_events(id,kind,surface,environment,modal_id,search_details) VALUES(_id,'refinement',_surface,_environment,_modal_id,safe_details) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.record_directory_refinement(uuid,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_directory_refinement(uuid,uuid,text,text,jsonb) TO anon,authenticated,service_role;
GRANT SELECT ON public.directory_activity_events TO authenticated;
GRANT ALL ON public.directory_activity_events TO service_role;
COMMENT ON COLUMN public.directory_activity_events.search_details IS 'Catalogue-only matches and refinement categories; never raw query text. Historical NULL remains unknown.';