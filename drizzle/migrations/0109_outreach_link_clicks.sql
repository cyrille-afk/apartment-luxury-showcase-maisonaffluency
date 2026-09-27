CREATE TABLE public.acquisition_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('instagram','linkedin','email')),
  hook text CHECK (hook IN ('A','B')),
  agent_id uuid,
  lead_id uuid REFERENCES public.acquisition_leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.acquisition_link_clicks TO authenticated;
GRANT ALL ON public.acquisition_link_clicks TO service_role;
ALTER TABLE public.acquisition_link_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read link clicks" ON public.acquisition_link_clicks FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE INDEX ON public.acquisition_link_clicks (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_outreach_click(_channel text, _hook text, _agent uuid, _lead uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid; l uuid;
BEGIN
  IF _channel NOT IN ('instagram','linkedin','email') THEN RETURN; END IF;
  IF _hook IS NOT NULL AND _hook NOT IN ('A','B') THEN _hook := NULL; END IF;
  SELECT _agent INTO a WHERE _agent IS NOT NULL AND (has_role(_agent,'admin') OR has_role(_agent,'super_admin'));
  SELECT id INTO l FROM acquisition_leads WHERE id = _lead;
  -- de-dupe repeat opens of the same link within 30 min; global flood cap
  IF EXISTS (SELECT 1 FROM acquisition_link_clicks WHERE channel=_channel AND lead_id IS NOT DISTINCT FROM l
             AND agent_id IS NOT DISTINCT FROM a AND created_at > now() - interval '30 minutes') THEN RETURN; END IF;
  IF (SELECT count(*) FROM acquisition_link_clicks WHERE created_at > now() - interval '1 hour') > 500 THEN RETURN; END IF;
  INSERT INTO acquisition_link_clicks(channel, hook, agent_id, lead_id) VALUES (_channel, _hook, a, l);
END $$;
REVOKE ALL ON FUNCTION public.log_outreach_click(text,text,uuid,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.log_outreach_click(text,text,uuid,uuid) TO anon, authenticated;