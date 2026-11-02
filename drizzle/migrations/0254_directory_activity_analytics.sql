CREATE TABLE public.directory_activity_events (
 id uuid PRIMARY KEY,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 kind text NOT NULL CHECK (kind IN ('open','search','letter','dismiss','profile')),
 surface text NOT NULL CHECK (surface IN ('desktop','mobile')),
 modal_id uuid,
 letter text CHECK (letter ~ '^[A-Z]$'),
 reason text CHECK (reason IN ('escape','outside','close_button')),
 designer_slug text CHECK (length(designer_slug) <= 160),
 environment text NOT NULL CHECK (environment IN ('production','preview'))
);
GRANT SELECT ON public.directory_activity_events TO authenticated;
GRANT ALL ON public.directory_activity_events TO service_role;
ALTER TABLE public.directory_activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY directory_activity_admin_read ON public.directory_activity_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX directory_activity_time ON public.directory_activity_events (occurred_at, environment);
CREATE UNIQUE INDEX directory_activity_one_open_close ON public.directory_activity_events (modal_id,kind) WHERE kind IN ('open','dismiss');
CREATE FUNCTION public.record_directory_activity(_id uuid, _kind text, _surface text, _environment text, _modal_id uuid DEFAULT NULL, _letter text DEFAULT NULL, _reason text DEFAULT NULL, _designer_slug text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _kind NOT IN ('open','search','letter','dismiss','profile') OR _surface NOT IN ('desktop','mobile') OR _environment NOT IN ('production','preview') THEN RAISE EXCEPTION 'Invalid event'; END IF;
 IF _kind IN ('open','search','letter','dismiss') AND _modal_id IS NULL THEN RAISE EXCEPTION 'Missing modal'; END IF;
 IF _kind='letter' AND (_letter IS NULL OR _letter !~ '^[A-Z]$') THEN RAISE EXCEPTION 'Invalid initial'; END IF;
 IF _kind='dismiss' AND (_reason IS NULL OR _reason NOT IN ('escape','outside','close_button')) THEN RAISE EXCEPTION 'Invalid dismissal'; END IF;
 IF _kind='profile' AND (_designer_slug IS NULL OR _designer_slug !~ '^[a-z0-9][a-z0-9-]{0,159}$' OR NOT EXISTS (SELECT 1 FROM public.designers WHERE slug=_designer_slug AND is_published)) THEN RAISE EXCEPTION 'Invalid profile'; END IF;
 IF _modal_id IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtext(_modal_id::text));
  IF _kind <> 'open' AND NOT EXISTS (SELECT 1 FROM public.directory_activity_events WHERE modal_id=_modal_id AND kind='open' AND occurred_at > now()-interval '24 hours' AND environment=_environment) THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.directory_activity_events WHERE modal_id=_modal_id) >= 500 THEN RETURN; END IF;
 END IF;
 INSERT INTO public.directory_activity_events(id,kind,surface,environment,modal_id,letter,reason,designer_slug)
 VALUES(_id,_kind,_surface,_environment,_modal_id,CASE WHEN _kind='letter' THEN _letter END,CASE WHEN _kind='dismiss' THEN _reason END,CASE WHEN _kind='profile' THEN _designer_slug END) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.record_directory_activity(uuid,text,text,text,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_directory_activity(uuid,text,text,text,uuid,text,text,text) TO anon,authenticated,service_role;
CREATE FUNCTION public.admin_directory_activity(_days integer DEFAULT 30, _environment text DEFAULT 'production', _surface text DEFAULT 'all') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF _days NOT IN (7,30,90) OR _environment NOT IN ('production','preview') OR _surface NOT IN ('all','desktop','mobile') THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 WITH dates AS (SELECT generate_series((now() AT TIME ZONE 'Asia/Singapore')::date-(_days-1), (now() AT TIME ZONE 'Asia/Singapore')::date, interval '1 day')::date AS day),
 events AS (SELECT * FROM public.directory_activity_events WHERE environment=_environment AND (_surface='all' OR surface=_surface) AND occurred_at >= (((now() AT TIME ZONE 'Asia/Singapore')::date-(_days-1))::timestamp AT TIME ZONE 'Asia/Singapore')),
 daily AS (SELECT dates.day, count(e.id) FILTER(WHERE kind='search') AS searches,count(e.id) FILTER(WHERE kind='letter') AS letters,count(e.id) FILTER(WHERE kind='profile') AS profiles,count(e.id) FILTER(WHERE kind='open') AS opens FROM dates LEFT JOIN events e ON (e.occurred_at AT TIME ZONE 'Asia/Singapore')::date=dates.day GROUP BY dates.day),
 cohorts AS (SELECT (o.occurred_at AT TIME ZONE 'Asia/Singapore')::date AS day,count(*) FILTER(WHERE d.id IS NOT NULL) AS dismissed FROM events o LEFT JOIN public.directory_activity_events d ON d.modal_id=o.modal_id AND d.kind='dismiss' AND d.environment=o.environment WHERE o.kind='open' GROUP BY 1)
 SELECT jsonb_build_object('updated_at',now(),'started_at',(SELECT min(occurred_at) FROM public.directory_activity_events WHERE environment=_environment),'days',(SELECT jsonb_agg(jsonb_build_object('day',daily.day,'searches',searches,'letters',letters,'profiles',profiles,'opens',opens,'dismissed',coalesce(cohorts.dismissed,0)) ORDER BY daily.day) FROM daily LEFT JOIN cohorts USING(day)), 'letters',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT letter,count(*) AS count FROM events WHERE kind='letter' GROUP BY letter ORDER BY letter) t), 'reasons',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT reason,count(*) AS count FROM events WHERE kind='dismiss' GROUP BY reason ORDER BY reason) t)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_directory_activity(integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_directory_activity(integer,text,text) TO authenticated;
COMMENT ON TABLE public.directory_activity_events IS 'Consent-aware directory analytics only; no identities or search text. Anonymous bounded ingestion is untrusted telemetry, never authorization or commerce evidence.';