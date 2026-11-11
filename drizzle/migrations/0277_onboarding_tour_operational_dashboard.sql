CREATE TABLE public.onboarding_tour_runs (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, tour text NOT NULL CHECK(tour IN ('felix','quick')), environment text NOT NULL CHECK(environment IN ('production','preview')), mode text NOT NULL CHECK(mode IN ('manual','automatic','resumed')), replay boolean NOT NULL DEFAULT false, total_steps integer NOT NULL CHECK(total_steps BETWEEN 1 AND 100), started_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, exit_reason text CHECK(exit_reason IN ('dismissed','page_exit')), last_step text, last_step_number integer, viewed_steps jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT ON public.onboarding_tour_runs TO authenticated;
GRANT ALL ON public.onboarding_tour_runs TO service_role;
ALTER TABLE public.onboarding_tour_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY onboarding_admin_read ON public.onboarding_tour_runs FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX onboarding_tour_run_period ON public.onboarding_tour_runs(environment,tour,started_at);
CREATE FUNCTION public.record_onboarding_tour_run(_id uuid,_kind text,_tour text,_environment text,_mode text,_replay boolean,_total integer,_step text DEFAULT NULL,_number integer DEFAULT NULL,_reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.onboarding_tour_runs;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF _id IS NULL OR _kind IS NULL OR _kind NOT IN ('start','view','complete','exit') OR _tour IS NULL OR _tour NOT IN ('felix','quick') OR _environment IS NULL OR _environment NOT IN ('production','preview') OR _mode IS NULL OR _mode NOT IN ('manual','automatic','resumed') OR _total IS NULL OR _total NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid tour event'; END IF;
 IF _kind<>'start' AND (_step IS NULL OR _step !~ '^[a-z0-9-]{1,80}$' OR _number IS NULL OR _number NOT BETWEEN 1 AND _total) THEN RAISE EXCEPTION 'Invalid tour step'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,81732));
 IF _kind='start' THEN
  IF (SELECT count(*) FROM public.onboarding_tour_runs WHERE owner_id=auth.uid() AND started_at>now()-interval '1 hour')>=60 THEN RAISE EXCEPTION 'Tour activity limit'; END IF;
  INSERT INTO public.onboarding_tour_runs(id,owner_id,tour,environment,mode,replay,total_steps) VALUES(_id,auth.uid(),_tour,_environment,_mode,coalesce(_replay,false),_total) ON CONFLICT(id) DO NOTHING;
  RETURN;
 END IF;
 SELECT * INTO r FROM public.onboarding_tour_runs WHERE id=_id AND owner_id=auth.uid() FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Tour run unavailable' USING ERRCODE='42501'; END IF;
 IF r.tour<>_tour OR r.total_steps<>_total OR r.environment<>_environment THEN RAISE EXCEPTION 'Tour context changed'; END IF;
 IF r.completed_at IS NOT NULL THEN RETURN; END IF;
 IF _kind='exit' AND (_reason IS NULL OR _reason NOT IN ('dismissed','page_exit')) THEN RAISE EXCEPTION 'Invalid exit'; END IF;
 UPDATE public.onboarding_tour_runs SET updated_at=now(),last_step=_step,last_step_number=_number,
 viewed_steps=CASE WHEN _kind='view' AND NOT viewed_steps @> jsonb_build_array(_step) THEN viewed_steps||jsonb_build_array(_step) ELSE viewed_steps END,
 completed_at=CASE WHEN _kind='complete' THEN now() ELSE completed_at END,
 exit_reason=CASE WHEN _kind='exit' THEN _reason ELSE NULL END WHERE id=r.id;
END $$;
REVOKE ALL ON FUNCTION public.record_onboarding_tour_run(uuid,text,text,text,text,boolean,integer,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_onboarding_tour_run(uuid,text,text,text,text,boolean,integer,text,integer,text) TO authenticated;
CREATE FUNCTION public.admin_onboarding_tour_activity(_days integer DEFAULT 30,_environment text DEFAULT 'production',_tour text DEFAULT 'felix') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF _days IS NULL OR _days NOT IN (7,30,90) OR _environment IS NULL OR _environment NOT IN ('production','preview') OR _tour IS NULL OR _tour NOT IN ('felix','quick') THEN RAISE EXCEPTION 'Invalid filters'; END IF;
 RETURN jsonb_build_object('updated_at',now(),'started_at',(SELECT min(started_at) FROM public.onboarding_tour_runs WHERE environment=_environment AND tour=_tour),'runs',coalesce((SELECT jsonb_agg(jsonb_build_object('started_at',started_at,'updated_at',updated_at,'completed',completed_at IS NOT NULL,'replay',replay,'mode',mode,'exit_reason',exit_reason,'last_step',last_step,'last_step_number',last_step_number,'viewed_steps',viewed_steps,'total_steps',total_steps) ORDER BY started_at) FROM public.onboarding_tour_runs WHERE environment=_environment AND tour=_tour AND started_at>=(((now() AT TIME ZONE 'Asia/Singapore')::date-(_days-1))::timestamp AT TIME ZONE 'Asia/Singapore')),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.admin_onboarding_tour_activity(integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_tour_activity(integer,text,text) TO authenticated;