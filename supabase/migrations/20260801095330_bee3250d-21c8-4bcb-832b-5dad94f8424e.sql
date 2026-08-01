CREATE INDEX IF NOT EXISTS client_board_items_pending_mobile_idx
  ON public.client_board_items (board_id, created_at DESC)
  WHERE saved_via = 'mobile' AND seen_on_desktop_at IS NULL;