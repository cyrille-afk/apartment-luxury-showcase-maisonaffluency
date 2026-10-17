CREATE TABLE public.stripe_delivery_checks (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, checked_at timestamptz NOT NULL DEFAULT now(), available boolean NOT NULL, missing_live_events integer NOT NULL DEFAULT 0);
GRANT SELECT ON public.stripe_delivery_checks TO authenticated;
GRANT ALL ON public.stripe_delivery_checks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.stripe_delivery_checks_id_seq TO service_role;
ALTER TABLE public.stripe_delivery_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read Stripe delivery checks" ON public.stripe_delivery_checks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE INDEX stripe_delivery_checks_time_idx ON public.stripe_delivery_checks (checked_at DESC);
CREATE OR REPLACE FUNCTION public.admin_stripe_metrics(_days integer DEFAULT 7) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb; span integer; since_at timestamptz; bucket text;
BEGIN
 IF NOT (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role)) THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
 IF _days IS NULL OR _days NOT IN (1,7,30) THEN RAISE EXCEPTION 'Choose 1, 7 or 30 days' USING ERRCODE='22023'; END IF;
 span := _days; since_at := now()-make_interval(days=>span); bucket := CASE WHEN span=1 THEN 'hour' ELSE 'day' END;
 WITH live AS (
 SELECT event_id,event_type,status,attempts,ack_ms,created_at,processed_at,
 greatest(0,extract(epoch from (processed_at-created_at))*1000) AS processing_ms,
 CASE WHEN payload->>'created' ~ '^[0-9]{1,12}$' THEN greatest(0,extract(epoch from created_at)*1000-(payload->>'created')::numeric*1000) END AS delivery_ms
 FROM public.webhook_events WHERE provider='stripe' AND payload->>'livemode'='true' AND created_at>=since_at
 ), times AS (SELECT generate_series(date_trunc(bucket,since_at AT TIME ZONE 'UTC'),date_trunc(bucket,now() AT TIME ZONE 'UTC'),CASE WHEN span=1 THEN interval '1 hour' ELSE interval '1 day' END) AS at),
 ev AS (SELECT date_trunc(bucket,created_at AT TIME ZONE 'UTC') AS at,count(*) AS received,count(*) FILTER(WHERE status='processed') AS processed,count(*) FILTER(WHERE status='failed') AS failed,round(avg(ack_ms)) AS ack_ms,round(avg(processing_ms)) AS processing_ms,round(avg(delivery_ms)) AS delivery_ms FROM live GROUP BY 1),
 sig AS (SELECT date_trunc(bucket,occurred_at AT TIME ZONE 'UTC') AS at,count(*) AS errors FROM public.security_audit_events WHERE source='stripe-webhook' AND event_type='stripe_signature_rejected' AND occurred_at>=since_at GROUP BY 1)
 SELECT jsonb_build_object('checked_at',now(),'totals',(SELECT jsonb_build_object('received',count(*),'processed',count(*) FILTER(WHERE status='processed'),'failed',count(*) FILTER(WHERE status='failed'),'pending',count(*) FILTER(WHERE status IN ('pending','processing')),'ack_ms',round(avg(ack_ms)),'processing_ms',round(avg(processing_ms)),'p95_processing_ms',round((percentile_cont(0.95) WITHIN GROUP(ORDER BY processing_ms))::numeric),'delivery_ms',round(avg(delivery_ms))) FROM live),
 'signature_errors',(SELECT coalesce(sum(errors),0) FROM sig),
 'series',(SELECT coalesce(jsonb_agg(jsonb_build_object('at',t.at AT TIME ZONE 'UTC','received',coalesce(e.received,0),'processed',coalesce(e.processed,0),'failed',coalesce(e.failed,0),'signature_errors',coalesce(s.errors,0),'ack_ms',e.ack_ms,'processing_ms',e.processing_ms,'delivery_ms',e.delivery_ms) ORDER BY t.at),'[]'::jsonb) FROM times t LEFT JOIN ev e USING(at) LEFT JOIN sig s USING(at)),
 'provider_latest',(SELECT jsonb_build_object('checked_at',checked_at,'available',available,'missing_live_events',missing_live_events) FROM public.stripe_delivery_checks ORDER BY checked_at DESC LIMIT 1),
 'provider_history',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY checked_at),'[]'::jsonb) FROM (SELECT checked_at,available,missing_live_events FROM public.stripe_delivery_checks WHERE checked_at>=since_at ORDER BY checked_at DESC LIMIT 5000)c),
 'recent',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY created_at DESC),'[]'::jsonb) FROM (SELECT event_id,event_type,status,attempts,ack_ms,round(processing_ms) AS processing_ms,round(delivery_ms) AS delivery_ms,created_at,processed_at FROM live ORDER BY created_at DESC LIMIT 20)r)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_stripe_metrics(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_stripe_metrics(integer) TO authenticated;