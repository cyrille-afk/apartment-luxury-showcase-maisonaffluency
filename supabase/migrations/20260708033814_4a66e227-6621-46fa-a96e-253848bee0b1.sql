ALTER TABLE public.client_boards
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.client_boards
  DROP CONSTRAINT IF EXISTS client_boards_source_check;

ALTER TABLE public.client_boards
  ADD CONSTRAINT client_boards_source_check
  CHECK (source IN ('manual', 'concierge'));

CREATE INDEX IF NOT EXISTS client_boards_source_idx
  ON public.client_boards (user_id, source);