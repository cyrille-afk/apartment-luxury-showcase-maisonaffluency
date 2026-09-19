ALTER TABLE public.client_board_items REPLICA IDENTITY FULL;
ALTER TABLE public.client_boards REPLICA IDENTITY FULL;
ALTER TABLE public.studio_alerts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_board_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.studio_alerts;