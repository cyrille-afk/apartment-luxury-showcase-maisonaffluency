CREATE TABLE public.whatsapp_delivery_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_sid TEXT NOT NULL,
  message_status TEXT,
  error_code INTEGER,
  error_message TEXT,
  to_number TEXT,
  from_number TEXT,
  channel TEXT NOT NULL DEFAULT 'twilio_whatsapp',
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_delivery_events_sid_created
  ON public.whatsapp_delivery_events (message_sid, created_at DESC);

GRANT SELECT ON public.whatsapp_delivery_events TO authenticated;
GRANT ALL ON public.whatsapp_delivery_events TO service_role;

ALTER TABLE public.whatsapp_delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view whatsapp delivery events"
ON public.whatsapp_delivery_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));