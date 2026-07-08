ALTER TABLE public.client_board_items
  ADD COLUMN IF NOT EXISTS variant_label text,
  ADD COLUMN IF NOT EXISTS fabric_label text,
  ADD COLUMN IF NOT EXISTS wood_label text;