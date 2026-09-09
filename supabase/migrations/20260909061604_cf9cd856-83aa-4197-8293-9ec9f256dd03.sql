ALTER TABLE public.whatsapp_delivery_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_delivery_events;