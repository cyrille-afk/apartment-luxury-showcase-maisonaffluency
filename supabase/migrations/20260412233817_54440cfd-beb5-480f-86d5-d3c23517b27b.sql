
-- Create board_recommendations table
CREATE TABLE public.board_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES public.client_boards(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (board_id, product_id)
);

-- Index for fast lookups by board
CREATE INDEX idx_board_recommendations_board_id ON public.board_recommendations(board_id);

-- Enable RLS
ALTER TABLE public.board_recommendations ENABLE ROW LEVEL SECURITY;

-- Board owners can view their own recommendations
CREATE POLICY "Board owners can view recommendations"
  ON public.board_recommendations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_boards
      WHERE client_boards.id = board_recommendations.board_id
        AND client_boards.user_id = auth.uid()
    )
  );

-- Admins can manage all recommendations
CREATE POLICY "Admins can manage recommendations"
  ON public.board_recommendations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert/update (for edge function)
CREATE POLICY "Service role can manage recommendations"
  ON public.board_recommendations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
